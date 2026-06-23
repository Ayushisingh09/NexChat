# NexChat 1-to-1 Voice & Video Calling — Progress & Roadmap

This document outlines the current state, what has been completed, what is left to do, and the step-by-step plan to deliver a production-ready, beautiful 1-to-1 voice/video calling experience powered by **LiveKit** and routed via the existing WebSocket/Socket.io channels.

---

## 🛠️ What We Have Done So Far

### 1. Database & Schema Configuration (Backend)
- [x] **Prisma Schema Update**: Added `CallStatus` enum (`RINGING`, `ONGOING`, `ENDED`, `MISSED`, `REJECTED`, `CANCELLED`) and a robust `Call` model to track caller, callee, room name, timing, and duration metadata.
- [x] **User Relations**: Associated calling fields on the `User` model to track call histories easily (`callsInitiated`, `callsReceived`).
- [x] **Database Synchronization**: Successfully ran `prisma db push` to synchronize our schema directly with the PostgreSQL container database and regenerate the client cleanly.

### 2. LiveKit Config & REST API (Backend)
- [x] **LiveKit SDK Integration**: Added `livekit-server-sdk` on the backend to sign and generate short-lived JWT tokens.
- [x] **Env Validation**: Configured `src/config/env.ts` with Zod validation rules for `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_HOST`, and `CALL_TIMEOUT_MS` (defaults to 30s).
- [x] **Lazy Token Generation**: Tokens are NOT generated during `initiate` — they are only generated when the callee clicks "Accept" via `POST /api/calls/:callId/accept`. This prevents token waste on unanswered calls.
- [x] **REST API Controller**: Implemented `CallController` with lazy token flow:
  - `initiate`: Creates database record, notifies callee via socket (NO token yet), schedules auto-timeout.
  - `accept`: Generates tokens for both users, emits `call:accepted` with tokens to both parties.
  - `reject` / `end` / `cancel`: State machine mutations with socket notifications.
  - `token`: Token regeneration for seamless reconnects.
  - `history`: Recent call logs for the logged-in user.
  - `webhook`: LiveKit webhook handler for `room_started`, `room_finished`, `participant_left` events.
- [x] **Express Routing**: Mounted `/api/calls/*` routes globally in `server.ts`. Webhook route is mounted BEFORE JWT auth (LiveKit signs the body).
- [x] **Security Headers (CSP)**: Enhanced Content Security Policy (CSP) in `server.ts` to allow `connectSrc`, `mediaSrc`, and `frameSrc` with the LiveKit host.
- [x] **Room Lifecycle Management**: Token TTL is 5 minutes; room has a 120-second `empty_timeout` to prevent self-destruction during reconnections.

### 3. Signaling & WebSockets (Backend)
- [x] **Socket.io Core Events**: Registered real-time socket events in `server.ts` with lazy token generation:
  - `call:accept`: Generates tokens on-the-fly and emits to both caller and callee.
  - `call:reject`, `call:end`, `call:cancel`: State mutations with socket notifications.
- [x] **LiveKit Webhooks**: `/api/calls/webhook` endpoint handles `room_started`, `room_finished`, `participant_left` events from LiveKit server. Logs room lifecycle and auto-closes calls on `room_finished`.

### 4. Client Core Stack & Hook Handlers (Frontend)
- [x] **Library Installations**: Installed `livekit-client` and `@livekit/components-react` on the frontend.
- [x] **Client State Management**: Zustand `call.store.ts` with full state machine plus:
  - `isReconnecting` / `reconnectAttempt` — reconnection UI state
  - `localQuality` / `remoteQuality` — network quality indicators (`excellent` | `good` | `poor` | `unknown`)
  - `activeSpeakerId` — active speaker detection for glow borders
  - `hasScreenShare` — dynamic layout switching when screen share is detected
- [x] **REST Call API**: `/src/api/calls.api.ts` for all call lifecycle endpoints.
- [x] **Smart Reconnection (`useLiveKitCall.ts`)**: Hooks into `RoomEvent.Reconnecting`, `RoomEvent.Reconnected`, `RoomEvent.Disconnected`. Shows reconnection banner with attempt count. Media tracks attempt graceful resume without destroying the session. Automatic reconnect attempt on initial connection failure.
- [x] **Network Quality Monitoring**: Subscribes to `RoomEvent.ConnectionQualityChanged` and maps LiveKit's quality levels to UI states. Exposed via `localQuality`/`remoteQuality` in the store.
- [x] **Active Speaker Detection**: Listens to `RoomEvent.ActiveSpeakersChanged` to identify the dominant speaker and trigger animated neon glow borders.
- [x] **Screen Share Layout**: Detects `Track.Source.ScreenShare` via `TrackSubscribed`/`TrackUnsubscribed` events. When active, switches to a focus layout with screen share as primary and camera feeds in a sidebar.
- [x] **WebSocket Hook (`useCallSocket.ts`)**: Subscribes to all 7 socket events. Handles lazy token flow — receives token only on `call:accepted`, not during ringing.
- [x] **Incoming Call Modal**: Updated to use REST API for accept (server generates tokens lazily).

### 5. Call UI Screens (Frontend)
- [x] **`IncomingCallModal.tsx`**: Full-screen modal with accept/decline, calls REST API on accept (lazy token).
- [x] **`OutgoingCallModal.tsx`**: Ringing animation with cancel button.
- [x] **`InCallUI.tsx`**: Active call screen with:
  - Remote video fullscreen, local video PiP corner
  - **Reconnection banner** — amber warning with attempt count
  - **Network quality indicators** — signal bars for both participants
  - **Active speaker glow** — animated neon/RGB border on dominant speaker
  - **Dynamic screen share layout** — auto-switches to focus mode with sidebar camera feeds
  - Mute, camera, screen share, minimize, end call controls
  - Duration timer
- [x] **`CallPiP.tsx`**: Draggable floating bubble with:
  - Mini video thumbnail (remote participant) or avatar fallback
  - Duration, mute status, network quality dot
  - Reconnection indicator overlay
- [x] **`CallOverlay.tsx`**: Root overlay mounting all call hooks and conditionally rendering the correct UI.

### 6. Integration & Mounting (Frontend)
- [x] **Mount Calls in Global layout**: `CallOverlay` mounted in `ChatPage.tsx` so calling works globally.
- [x] **Call Actions in Header**: Voice/video call buttons in `ChatHeader.tsx` for DIRECT conversations.

### 7. Styling
- [x] **Active Speaker Glow CSS**: Animated gradient border (`cyan → purple → pink`) with blur and pulse animation in `index.css`.

### 8. Testing
- [x] **Service Tests** (`service.test.ts`): 8 tests covering token generation, room name determinism, duration formatting, empty timeout, and webhook receiver.
- [x] **Controller Tests** (`controller.test.ts`): 7 tests covering lazy token flow (initiate doesn't generate, accept does), webhook room_finished handling, reject, end with duration computation, and reconnection token generation.
- [x] **All 15 tests passing**.

---

## ⏳ What Is Left to Do

### 1. Documentation
- [ ] Write down exactly what environment variables are needed, VPS ports, and the complete end-to-end testing flow.

### 2. Optional Enhancements
- [ ] Audio waveform visualization next to active speaker name
- [ ] Call history UI component showing past calls with duration/status
- [ ] Group calling support (multi-party rooms)

---

## 📋 End-to-End Test Plan

1. **User A** calls **User B** → B sees IncomingCallModal, A sees OutgoingCallModal (NO LiveKit connection yet)
2. **User B** clicks Accept → server generates tokens, both receive `call:accepted` with tokens → both connect to LiveKit room
3. Verify video/audio streams bidirectionally
4. Toggle mute/camera → verify tracks pause/resume on other side
5. Start screen share → layout switches to focus mode with sidebar cameras
6. Navigate away → InCallUI minimizes to draggable CallPiP with live video thumbnail
7. Simulate network drop → reconnection banner appears, media resumes on reconnect
8. End call → both modals close, call recorded in database with correct duration
9. Verify call history shows the completed call

---

## 🚀 Step-by-Step Action Plan (Completed)

1. ~~Write `OutgoingCallModal.tsx`~~ ✅
2. ~~Write `InCallUI.tsx`~~ ✅ (with reconnection, quality, speaker glow, screen share layout)
3. ~~Write `CallPiP.tsx`~~ ✅ (with video thumbnail, quality dot)
4. ~~Mount globally~~ ✅ (via `CallOverlay.tsx` in `ChatPage.tsx`)
5. ~~Add Call buttons~~ ✅ (in `ChatHeader.tsx`)
6. ~~Lazy Token Generation~~ ✅ (tokens only on accept)
7. ~~LiveKit Webhooks~~ ✅ (`/api/calls/webhook`)
8. ~~Smart Reconnection~~ ✅ (Reconnecting/Reconnected/Disconnected events)
9. ~~Network Quality Monitoring~~ ✅ (quality indicators in UI)
10. ~~Active Speaker Detection~~ ✅ (neon glow borders)
11. ~~Dynamic Screen Share Layout~~ ✅ (focus mode + sidebar)
12. ~~Tests~~ ✅ (15 passing)
13. ~~Build Verification~~ ✅ (both frontend and backend compile cleanly)
