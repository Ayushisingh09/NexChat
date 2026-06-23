# NexChat 1-to-1 Voice & Video Calling — Architecture & Deployment Guide

This guide describes the complete technical specification, communication protocols, signaling state machine, frontend client integration, and self-hosted server deployment instructions for the 1-to-1 WebRTC voice and video calling system in NexChat.

---

## 🏗️ 1. Technical Architecture Overview

NexChat implements a hybrid WebRTC architecture utilizing a self-hosted **LiveKit SFU (Selective Forwarding Unit)** for high-quality audio and video transport, combined with our existing **Node.js/Socket.io backend** to handle call orchestration, signaling, and metadata storage.

```
+--------------------+                     +--------------------+
|                    |  Signaling (WS)     |                    |
|   Caller Client    |<===================>|  Express/Socket    |
|                    |                     |   (Chat Backend)   |
+--------------------+                     +--------------------+
          |                                          ^
          | WebRTC Media                              | REST API Auth
          v                                          v
+--------------------+                     +--------------------+
|                    |                     |                    |
|   LiveKit Server   |<===================>|   Prisma Database  |
|       (SFU)        |  Generate Room JWT  |                    |
+--------------------+                     +--------------------+
```

### Key Architectural Decisions:
- **No Direct Signaling**: Instead of complex peer-to-peer ICE negotiation, we utilize LiveKit to handle connection scaling. Our signaling channels only coordinate the call lifecycle (invites, acceptance, rejections, terminations).
- **JWT Room Tokens**: LiveKit room tokens are generated server-side using the secret API Key. The client never accesses these credentials, guaranteeing secure, authenticated room admission.
- **Short-Lived Sessions**: Tokens have a 5-minute Time-To-Live (TTL) and are uniquely scoped to a specific room (`caller__callee`), preventing session interception.

---

## 📊 2. Database Schema Definition

A new `Call` table and `CallStatus` enum have been added to the PostgreSQL schema to log session parameters and display complete calling histories in user profiles.

```prisma
enum CallStatus {
  RINGING
  ONGOING
  ENDED
  MISSED
  REJECTED
  CANCELLED
}

model Call {
  id        String     @id @default(cuid())
  callerId  String
  calleeId  String
  roomName  String     @unique
  status    CallStatus @default(RINGING)
  startedAt DateTime?
  endedAt   DateTime?
  duration  Int?       // Duration in seconds
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  caller User @relation("Caller", fields: [callerId], references: [id])
  callee User @relation("Callee", fields: [calleeId], references: [id])

  @@index([callerId])
  @@index([calleeId])
  @@index([status])
}
```

---

## 📡 3. Real-Time Signaling Protocol & Socket Events

Signaling relies on our existing Socket.io transport layer. Below is the precise state transition mapping for calls.

### 1. Initiation (`call:invite` & `call:ringing`)
- **Caller** triggers `POST /api/calls/initiate` passing `{ userId: "callee-id" }`.
- **Backend** validates permissions, generates the room name `callerId__calleeId`, generates separate caller/callee JWTs, and emits:
  - `call:invite` to **Callee's** personal socket channel.
  - `call:ringing` to **Caller's** personal socket channel.

### 2. Decision (`call:accept` or `call:reject`)
- **Callee** triggers `POST /api/calls/:id/accept`:
  - **Backend** sets status to `ONGOING` and saves `startedAt`.
  - Emits `call:accepted` to **Caller's** socket. Both clients then initialize LiveKit connections.
- **Callee** triggers `POST /api/calls/:id/reject` or clicks decline:
  - **Backend** updates status to `REJECTED`.
  - Emits `call:rejected` to **Caller**. Connection is torn down.

### 3. Termination (`call:end` or `call:cancel`)
- **Caller** clicks cancel before acceptance:
  - **Backend** updates status to `CANCELLED`.
  - Emits `call:cancelled` to **Callee**. Ringing modal closes.
- **Either Party** hangs up during an active session:
  - **Backend** updates status to `ENDED`, computes `duration`, and saves `endedAt`.
  - Emits `call:ended` to both sockets. LiveKit room is closed.

### 4. Automatic Missed Call Timeout
- If a call remains in the `RINGING` state for more than 30 seconds (configurable via `CALL_TIMEOUT_MS`), the backend automatically updates status to `MISSED` and broadcasts `call:missed` to both endpoints.

---

## 💻 4. Frontend State Management & Hooks

Zustand (`call.store.ts`) acts as our single source of truth for handling active calls, permissions, UI rendering, and hardware states.

```typescript
export interface CallState {
  callId: string | null;
  roomName: string | null;
  token: string | null;
  participant: CallParticipant | null;
  direction: 'outgoing' | 'incoming' | null;
  status: 'idle' | 'ringing' | 'ongoing';
  liveKitConnected: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isMinimized: boolean;
  duration: number;
}
```

### Key Custom Hooks:
- **`useLiveKitCall.ts`**: Subscribes to the LiveKit connection, coordinates automatic reconnects, tracks quality warnings, and manages local/remote audio and video tracks.
- **`useCallSocket.ts`**: Standardizes global socket event listening, automatically triggering the correct Zustand actions regardless of what screen the user is currently on.

---

## 🚀 5. VPS & Infrastructure Configuration

To host LiveKit on a private VPS, certain ports must be open. LiveKit uses standard WebRTC ports to bypass firewall blockades.

### Firewall Port Configuration (UFW)
```bash
# WebRTC Signaling & API (TCP)
sudo ufw allow 7880/tcp
sudo ufw allow 7881/tcp

# WebRTC Media Transport (UDP)
sudo ufw allow 50000:60000/udp

# TURN over TLS (TCP) — required for cellular/corporate networks
sudo ufw allow 5349/tcp
```

### LiveKit Server Config (`/etc/livekit/livekit.yaml`)
```yaml
port: 7880
bind_addresses:
  - "0.0.0.0"
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
turn:
  enabled: true
  domain: "livekit.92lrcorps.xyz"
  tls_port: 5349
  cert_file: "/etc/letsencrypt/live/livekit.92lrcorps.xyz/fullchain.pem"
  key_file: "/etc/letsencrypt/live/livekit.92lrcorps.xyz/privkey.pem"
keys:
  APIaew4267Rs2iJ: "dOCKxeiAMsGhBs7GQnVgdnD9OI61eYckgKa3MVxmhmk"
logging:
  level: "info"
  sample: true
```

> **Note:** The actual TLS cert for TURN is loaded via `--turn-cert`/`--turn-key`
> flags in the systemd service (`/etc/systemd/system/livekit.service`).
> `livekit.92lrcorps.xyz` is DNS-only (grey cloud) → all traffic goes direct to VPS.

---

## 🔒 6. Security & NAT Traversal (STUN/TURN)

### NAT Traversal:
In real-world networks (especially cellular LTE/5G or restrictive corporate firewalls), direct peer-to-peer connection is blocked.
- **STUN** resolves the public IP address of both participants.
- **TURN** relays all media traffic through your server.
LiveKit has an integrated TURN server. If mobile users report "connecting forever," configure TURN by setting `turn.enabled: true` in `livekit.yaml` and providing a valid domain with TLS.

### Cloudflare Proxy Handling:
- **`livekit.92lrcorps.xyz`**: Currently **DNS-Only (Grey Cloud)** — all traffic (signaling, media, TURN) goes directly to the VPS at `15.207.108.95`.
- **Media Plane (`50000-60000/udp`)**: Must remain DNS-Only because Cloudflare does not support proxying high-bandwidth raw UDP streams.
- **TURN port (`5349/tcp`)**: Must remain DNS-Only — Cloudflare does not proxy non-standard TLS ports.
- If you re-enable Cloudflare proxy for signaling, ensure media and TURN ports remain grey cloud.

---

## 📋 7. End-to-End Test Plan

To verify that the signaling, JWT generation, and WebRTC streams work flawlessly, perform this test flow:

1. **Environment Setup**:
   Ensure `.env` in your Express backend contains:
   ```env
   LIVEKIT_API_KEY=APIaew4267Rs2iJ
   LIVEKIT_API_SECRET=dOCKxeiAMsGhBs7GQnVgdnD9OI61eYckgKa3MVxmhmk
   LIVEKIT_HOST=https://livekit.92lrcorps.xyz
   ```
2. **Account Provisioning**:
   - Register **User A** (on a browser/laptop).
   - Register **User B** (on a mobile device or secondary browser tab).
3. **Initiating Call**:
   - **User A** selects **User B** in friends list or DM.
   - Click the "Call" action.
   - **User A** should see the `OutgoingCallModal` with the "Ringing..." pulse.
4. **Receiving Call**:
   - **User B** should immediately see the `IncomingCallModal` displaying User A's avatar with Accept/Reject buttons.
5. **Connecting Streams**:
   - **User B** clicks Accept. Both states change to `ongoing`.
   - Local and remote camera/mic streams will initialize and render on-screen.
6. **Mute & Camera Controls**:
   - Verify that toggling the Mic/Camera buttons correctly pauses and resumes the corresponding tracks on the other side.
7. **Call Termination**:
   - Click "End Call". Verify that both modals close instantly, the LiveKit session is closed, and the call details are recorded in the database history.
