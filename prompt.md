# NexChat — Complete Kotlin Android App Build Prompt

> **Purpose:** This document is a self-contained specification for rebuilding the NexChat application as a production-grade Android APK using Kotlin + Jetpack Compose. It contains every API endpoint, WebSocket event, database model, UI screen, crypto protocol, and business rule extracted from the existing Node.js/TypeScript backend and React/Vite frontend. An AI given ONLY this file must be able to produce a working Android project.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Backend API Reference](#3-backend-api-reference)
4. [Database Schema](#4-database-schema)
5. [WebSocket / Socket.IO Events](#5-websocket--socketio-events)
6. [Authentication System](#6-authentication-system)
7. [End-to-End Encryption](#7-end-to-end-encryption)
8. [Media System](#8-media-system)
9. [Notification System](#9-notification-system)
10. [UI Screens & Navigation](#10-ui-screens--navigation)
11. [State Management Architecture](#11-state-management-architecture)
12. [Feature Inventory](#12-feature-inventory)
13. [Business Logic & Rules](#13-business-logic--rules)
14. [Project Structure](#14-project-structure)
15. [Implementation Phases](#15-implementation-phases)

---

## 1. Project Overview

**NexChat** is a full-featured real-time messaging application with:

- Private (1:1) and group chat
- End-to-end encryption (RSA-OAEP + AES-GCM)
- Stories (Instagram-style, 24h expiry)
- Communities (Discord-style servers with roles, events, moderation, analytics)
- Friends system with requests
- Polls in chat
- Voice messages, file/image/video sharing
- Disappearing messages
- Scheduled messages
- Pinned/starred messages
- Message reactions, replies, forwards, edits, deletes
- Read receipts (3-state: SENT → DELIVERED → READ)
- Typing indicators
- Presence (online/offline with 30s heartbeat lease)
- Push notifications (FCM)
- Link previews
- Translation proxy
- User blocking
- Group invite links
- Join approval flow
- Multi-device sessions with revoke
- App lock / PIN
- Key backup & restore (passphrase-wrapped PBKDF2)

---

## 2. Tech Stack & Dependencies

### Backend (already exists — you are building the CLIENT that talks to this)
- **Runtime:** Node.js + Express 5 + TypeScript
- **Database:** PostgreSQL via Prisma ORM (schema: `prisma/schema.prisma`, 704 lines)
- **Cache/PubSub:** Redis (ioredis)
- **Realtime:** Socket.IO 4.8 with Redis adapter (`@socket.io/redis-adapter`)
- **Auth:** JWT (access 15min + refresh 30d), bcryptjs
- **Storage:** Local filesystem (`/uploads/`) with presigned-URL grant via Redis
- **Push:** Firebase Admin SDK (FCM)
- **Email:** Resend / Nodemailer
- **SMS:** Twilio
- **Rate limiting:** express-rate-limit + custom Redis rate limiter + Arcjet bot protection
- **Base URL:** configurable via `SERVER_URL` env var

### Android (what you must build)
- **Language:** Kotlin
- **UI:** Jetpack Compose + Material 3
- **Architecture:** MVVM + Clean Architecture + Repository Pattern
- **DI:** Hilt
- **Networking:** Retrofit + OkHttp + Moshi/Gson
- **Realtime:** Socket.IO client (Java) — compatible with Socket.IO 4.8 server
- **Local DB:** Room
- **Image Loading:** Coil
- **Crypto:** JavaKeyPairGenerator + javax.crypto (RSA-OAEP, AES-GCM, PBKDF2)
- **Push:** Firebase Cloud Messaging
- **Background Work:** WorkManager
- **Secure Storage:** EncryptedSharedPreferences
- **Navigation:** Compose Navigation

---

## 3. Backend API Reference

### 3.1 Standard Response Envelope

Every API response follows this JSON structure:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... }        // optional, varies per endpoint
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error description",
  "errors": { ... }      // optional validation details
}
```

### 3.2 Authentication

- **Header:** `Authorization: Bearer <access_token>`
- **Access token lifetime:** 15 minutes
- **Refresh token lifetime:** 30 days (stored in DB, rotated on each refresh)
- **Token payload:** `{ id, email, phone, sid }` where `sid` = RefreshToken row ID (session ID)
- **Refresh flow:** POST `/api/auth/refresh` with `{ refreshToken }` → returns new `{ accessToken, refreshToken }` (old refresh token is deleted — rotation)

### 3.3 All API Endpoints

#### Auth — `POST /api/auth/*`

| Endpoint | Body | Response `data` | Notes |
|---|---|---|---|
| `POST /send-otp` | `{ email?: string, phone?: string }` | null | Sends 6-digit OTP via email/SMS. Rate limited. |
| `POST /verify-otp` | `{ email?: string, phone?: string, code: string(6) }` | null | Verifies OTP, stores verification in Redis for 10 min. |
| `POST /register` | `{ email?, phone?, password?(min 6), displayName(min 2), username?(3-30, alphanumeric+underscore), avatar? }` | `{ user: { id, email, phone, username, displayName, avatar }, accessToken, refreshToken }` | Auto-generates username if not provided. OTP verification required if `REQUIRE_OTP_VERIFICATION` env is set. Status 201. |
| `POST /login` | `{ email?, phone?, password?, code? }` | `{ user: { id, email, phone, displayName, avatar }, accessToken, refreshToken }` | Supports password login OR OTP code login. |
| `POST /refresh` | `{ refreshToken: string }` | `{ accessToken, refreshToken }` | Token rotation: old refresh token is deleted. |
| `POST /logout` | `{ refreshToken: string }` | null | Deletes the refresh token. |
| `POST /forgot-password` | `{ email: string }` | null | Sends reset link via email. Token stored in Redis for 15 min. |
| `POST /reset-password` | `{ token: string, newPassword(min 6) }` | null | Resets password using Redis-stored token. |
| `PUT /password` *(auth required)* | `{ currentPassword, newPassword(min 6) }` | null | Changes password for authenticated user. |

#### Users — `GET/PUT/POST/DELETE /api/users/*`

| Endpoint | Auth | Body/Params | Response `data` |
|---|---|---|---|
| `GET /me` | ✓ | — | Full user profile |
| `GET /search` | ✓ | `?q=` | Array of users matching query (max 20), with `isOnline`, `lastSeen`, `publicKey`. Excludes blocked users. |
| `POST /fcm-token` | ✓ | `{ fcmToken }` | — |
| `POST /public-key` | ✓ | `{ publicKey }` | — |
| `GET /public-key/:userId` | ✓ | — | Public key string |
| `PUT /me/key-backup` | ✓ | `{ ciphertext, salt, iv, iterations }` | — |
| `GET /me/key-backup` | ✓ | — | `{ ciphertext, salt, iv, iterations, updatedAt }` |
| `PUT /profile` | ✓ | `{ displayName?, avatar?, bio?, username?, lastSeenVisibility?, showEmail?, readReceiptsEnabled?, notificationsEnabled?, notificationSound? }` | Updated user |
| `GET /by-username/:username` | ✓ | — | User profile with presence |
| `GET /sessions` | ✓ | — | List of device sessions (each has `id`, `userAgent`, `ip`, `createdAt`, `lastUsedAt`, plus `isCurrent` boolean) |
| `DELETE /sessions/:id` | ✓ | — | Revokes a specific session |
| `POST /sessions/revoke-others` | ✓ | — | Revokes all sessions except current |
| `GET /blocked` | ✓ | — | Array of blocked users `{ id, displayName, avatar }` |
| `POST /block` | ✓ | `{ blockedId }` | — |
| `POST /unblock` | ✓ | `{ blockedId }` | — |
| `DELETE /me` | ✓ | `{ password }` | Deletes account (requires password) |

#### Conversations — `GET/POST/PUT/DELETE /api/conversations/*`

| Endpoint | Auth | Body/Params | Response `data` |
|---|---|---|---|
| `GET /` | ✓ | — | Array of conversations. Each has: `id, type, name, avatar, participants[] (with presence), lastMessage, unreadCount, updatedAt, pinnedAt, mutedUntil, archivedAt, disappearingTtlSeconds, description, isAnnouncementMode, requiresApproval, notificationPreference`. Sorted: pinned first (by pinnedAt desc), then by updatedAt desc. |
| `POST /` | ✓ | `{ type: "DIRECT"|"GROUP", name?, avatar?, participantIds[], description? }` | Created conversation. For DIRECT: finds or creates existing. Returns `{ id, type, name, avatar, participants, unreadCount, updatedAt }`. Status 201. |
| `POST /:id/clear` | ✓ | — | Sets `clearedAt` on participant |
| `POST /:id/pin` | ✓ | — | Toggles pin |
| `POST /:id/mute` | ✓ | `{ duration: "8h"|"1w"|"always"|"off" }` | — |
| `POST /:id/archive` | ✓ | `{ archived: boolean }` | — |
| `POST /:id/disappearing` | ✓ | `{ ttlSeconds: number|null }` | Admin-only in groups |
| `POST /:id/invites` | ✓ | `{ expiresInHours?, maxUses? }` | `{ token, expiresAt, maxUses, useCount, revoked, createdAt }` |
| `GET /:id/invites` | ✓ | — | Array of active invites |
| `PUT /:id/group` | ✓ | `{ name?, avatar?, description?, isAnnouncementMode?, requiresApproval?, isPublic?, invitePermission?, messagePermission?, editPermission? }` | Full conversation payload |
| `POST /:id/participants` | ✓ | `{ userIds: string[] }` | Full conversation payload |
| `DELETE /:id/participants/:userId` | ✓ | — | Removes participant |
| `PUT /:id/participants/:userId/role` | ✓ | `{ role: "ADMIN"|"MEMBER" }` | Full conversation payload |
| `GET /:id/join-requests` | ✓ | — | Pending join requests |
| `POST /:id/join-requests/:requestId/resolve` | ✓ | `{ action: "APPROVE"|"REJECT" }` | — |
| `GET /:id/audit-log` | ✓ | — | Audit logs (max 100) |
| `POST /:id/notification-preference` | ✓ | `{ preference: "ALL"|"MENTIONS_ONLY"|"MUTE" }` | — |
| `GET /:id/participants` | ✓ | `?offset=&limit=` (max 100) | `{ participants[], total, offset, limit, hasMore }` |
| `DELETE /:id` | ✓ | — | Leave group / clear DM |

#### Invites — `GET/POST/DELETE /api/invites/*`

| Endpoint | Auth | Body/Params | Response `data` |
|---|---|---|---|
| `GET /:token` | ✓ | — | `{ conversationId, name, avatar, memberCount }` |
| `POST /:token/join` | ✓ | — | Conversation payload (or `{ requiresApproval, request }`) |
| `DELETE /:token` | ✓ | — | Revokes invite |

#### Messages — `GET/POST/PATCH/DELETE /api/messages/*`

| Endpoint | Auth | Body/Params | Response `data` |
|---|---|---|---|
| `POST /` | ✓ | `{ conversationId, content, type?, mediaUrl?, replyToId?, mentionedUserIds?, mentionEveryone?, scheduledAt?, pollOptionCount? }` | Created message. Status 201. Content max 64KB. Scheduled up to 30 days ahead. Poll options 2-12. |
| `GET /:conversationId` | ✓ | `?cursor=&limit=` (default 25) | `{ messages[], nextCursor }`. Cursor-based pagination. Returns chronological (oldest first). Each message includes: `sender, replyTo, reactions[], starred, pollVotes[]`. |
| `POST /read/:conversationId` | ✓ | — | `{ markedRead, latestMessageId }` |
| `PATCH /:id` | ✓ | `{ content }` | Updated message (only TEXT, only own) |
| `DELETE /:id` | ✓ | `{ type: "ME"|"EVERYONE" }` | "EVERYONE" only for own messages |
| `POST /:id/star` | ✓ | — | `{ starred: boolean }` |
| `POST /:id/reactions` | ✓ | `{ emoji }` | `{ action: "add"|"remove", emoji }` |
| `POST /:id/pin` | ✓ | — | `{ pinned: boolean }` |
| `GET /:id/reactions` | ✓ | — | `{ [emoji]: { count, users[] } }` |
| `GET /:id/read-by` | ✓ | — | `{ readBy[], deliveredTo[] }` (only own messages) |
| `POST /:id/poll-vote` | ✓ | `{ optionIndex }` | `{ optionIndex }` (null to clear) |
| `GET /:id/poll-votes` | ✓ | — | `{ [optionIndex]: users[] }` |
| `POST /forward` | ✓ | `{ messageId, targetConversationId }` | Forwarded message. Status 201. |
| `GET /:conversationId/search` | ✓ | `?q=&cursor=&limit=` | `{ messages[], nextCursor }` |
| `GET /global-search` | ✓ | `?q=&cursor=&limit=` | `{ messages[] (with conversation), nextCursor }` |
| `GET /starred` | ✓ | `?cursor=&limit=` | `{ messages[], nextCursor }` |
| `GET /:conversationId/scheduled` | ✓ | — | `{ messages[] }` |
| `DELETE /scheduled/:id` | ✓ | — | Cancels scheduled message |
| `GET /:conversationId/stats` | ✓ | — | `{ mediaCount, fileCount, linkCount, voiceCount, mutualGroups?, mutualFriends? }` |
| `GET /:conversationId/media` | ✓ | `?category=MEDIA|DOCS&cursor=&limit=` | `{ messages[], nextCursor }` |
| `GET /:conversationId/pinned` | ✓ | — | Array of pinned messages |

#### Media — `POST /api/media/*`

| Endpoint | Auth | Body | Response `data` |
|---|---|---|---|
| `POST /presigned-url` | ✓ | `{ fileName, fileType, fileSize }` | `{ uploadUrl, publicUrl }` |
| `PUT /upload` | Redis grant | Raw binary body + `?filename=` | `{ success: true }` |
| `POST /link-preview` | ✓ | `{ url }` | `{ title, description, image, url }` |
| `POST /translate` | ✓ | `{ text, target }` | `{ translatedText, detectedSourceLang, target }` |

**Upload flow:**
1. Client requests presigned URL with file metadata
2. Server validates MIME type and size, creates Redis grant (10 min TTL)
3. Client PUTs raw binary to `uploadUrl` (no auth header — uses Redis grant)
4. Server writes to `/uploads/` directory, deletes grant
5. Public URL: `SERVER_URL/uploads/{uniqueName}`

**Allowed MIME types:**
- Image: jpeg, png, gif, webp, avif, heic, heif, svg+xml
- Video: mp4, webm, quicktime, x-matroska
- Audio: mpeg, mp4, aac, ogg, webm, wav, x-m4a
- Docs: pdf, zip, msword, openxmlformats (docx), ms-excel, ms-powerpoint, plain text, csv

**Size limits:** image 10MB, video 50MB, audio 16MB, other 50MB

#### Stories — `GET/POST/DELETE /api/stories/*`

| Endpoint | Auth | Body/Params | Response `data` |
|---|---|---|---|
| `POST /` | ✓ | `{ type: "IMAGE"|"VIDEO"|"TEXT", mediaUrl?, caption?, bgColor?, fontStyle? }` | Created story. Status 201. TTL: 24 hours. Caption max 700 chars. |
| `GET /feed` | ✓ | — | Array of story groups `{ userId, user: { id, displayName, avatar }, stories: [{ id, type, mediaUrl, caption, bgColor, fontStyle, createdAt, expiresAt, viewed }] }`. Own stories first, then by most recent. |
| `POST /:id/view` | ✓ | — | `{ viewed: boolean }` (false if own story) |
| `POST /:id/react` | ✓ | `{ emoji }` (from 👍❤️😂😮😢🔥) | `{ emoji }` |
| `GET /:id/views` | ✓ | — | `{ viewers[] (with reactionEmoji), reactionSummary }` (owner only) |
| `DELETE /:id` | ✓ | — | — |

#### Friends — `GET/POST/DELETE /api/friends/*`

| Endpoint | Auth | Body/Params | Response `data` |
|---|---|---|---|
| `GET /` | ✓ | — | Array of friends `{ id, displayName, avatar, ... }` |
| `GET /presence` | ✓ | — | Same as above + `isOnline` boolean |
| `GET /pending/received` | ✓ | — | Array of incoming friend requests |
| `GET /pending/sent` | ✓ | — | Array of outgoing friend requests |
| `POST /request` | ✓ | `{ userId }` | — |
| `POST /accept/:requestId` | ✓ | — | — |
| `POST /reject/:requestId` | ✓ | — | — |
| `POST /cancel/:requestId` | ✓ | — | — |
| `DELETE /:friendId` | ✓ | — | `{ removed: boolean }` |

#### Communities — `GET/POST/PUT/DELETE /api/communities/*`

| Endpoint | Auth | Body/Params | Response `data` |
|---|---|---|---|
| `POST /promote/:conversationId` | ✓ | — | Promotes a GROUP to a Community. Admin only. |
| `DELETE /:id` | ✓ | — | Demotes community back to group |
| `GET /by-conversation/:conversationId` | ✓ | — | `{ id, visibility, category, verificationStatus }` |
| `GET /:id` | ✓ | — | Full community profile with conversation, participants, roles, achievements, counts |
| `PUT /:id/profile` | ✓ | `{ name?, description?, banner?, website?, socialLinks?, rules?, tags?, welcomeMessage? }` | — |
| `PUT /:id/visibility` | ✓ | `{ visibility: "PUBLIC"|"PRIVATE" }` | — |
| `PUT /:id/category` | ✓ | `{ category }` | — |
| `PUT /:id/tags` | ✓ | `{ tags: string[] }` | — |
| `POST /:id/custom-url` | ✓ | `{ customUrl }` | — |
| `GET /url-available` | ✓ | `?url=` | `{ available: boolean }` |
| `GET /explore/list` | ✓ | `?category=&sort=&page=&limit=` | `{ communities[], pagination }` |
| `GET /explore/trending` | ✓ | — | Cached trending (60s TTL) |
| `GET /explore/featured` | ✓ | — | Cached featured (60s TTL) |
| `GET /explore/search` | ✓ | `?q=&category=&minMembers=&sort=&page=&limit=` | `{ communities[], pagination }` |
| `GET /recommendations` | ✓ | — | Based on user's joined community tags |
| `POST /:id/roles` | ✓ | `{ name, color?, permissions?, priority? }` | Status 201 |
| `PUT /:id/roles/:roleId` | ✓ | `{ name?, color?, permissions?, priority? }` | — |
| `DELETE /:id/roles/:roleId` | ✓ | — | — |
| `GET /:id/roles` | ✓ | — | Roles with members |
| `POST /:id/roles/assign` | ✓ | `{ roleId, participantId }` | — |
| `POST /:id/roles/unassign` | ✓ | `{ participantId }` | — |
| `POST /:id/events` | ✓ | `{ title, description?, type?, startsAt, endsAt?, maxAttendees? }` | Status 201 |
| `PUT /:id/events/:eventId` | ✓ | `{ title?, description?, type?, startsAt?, endsAt?, maxAttendees?, status? }` | — |
| `DELETE /:id/events/:eventId` | ✓ | — | — |
| `GET /:id/events` | ✓ | — | Events (not cancelled) with attendee counts |
| `POST /:id/events/:eventId/rsvp` | ✓ | `{ rsvp: "GOING"|"MAYBE"|"DECLINED" }` | — |
| `POST /:id/rate` | ✓ | `{ score(1-5), review? }` | `{ ratingAverage, ratingCount }` |
| `GET /:id/ratings` | ✓ | — | Last 50 ratings with user info |
| `DELETE /:id/rate` | ✓ | — | — |
| `GET /:id/highlights` | ✓ | — | Top 50 by reactionCount |
| `POST /:id/highlights` | ✓ | `{ messageId }` | Status 201 |
| `DELETE /:id/highlights/:hlId` | ✓ | — | — |
| `GET /:id/achievements` | ✓ | — | — |
| `GET /:id/leaderboard` | ✓ | `?period=&type=` | Top 50 |
| `GET /:id/analytics` | ✓ | — | Admin only. Total/current members, weekly active, message counts, top members. |
| `GET /:id/growth` | ✓ | — | Growth stats |
| `GET /:id/mod/settings` | ✓ | — | ModSettings object |
| `PUT /:id/mod/settings` | ✓ | `{ profanityFilter?, spamDetection?, linkProtection?, slowModeSeconds?, capsLimit?, repeatedCharLimit?, minAccountAgeDays?, requireVerifiedEmail?, maxJoinsPerMinute?, autoKickOnJoinRaid?, allowedDomains? }` | — |
| `POST /:id/mod/action` | ✓ | `{ action: "MUTE"|"KICK"|"BAN"|"WARN"|"UNBAN", targetId, reason?, durationMs? }` | — |
| `GET /:id/mod/logs` | ✓ | — | Last 100 mod actions |
| `POST /:id/reports` | ✓ | `{ targetType, targetId, reason, description? }` | Status 201 |
| `GET /:id/reports` | ✓ | — | Admin only. OPEN reports. |
| `PUT /:id/reports/:reportId/resolve` | ✓ | `{ status?, resolution? }` | — |
| `POST /:id/join` | ✓ | — | — |
| `POST /:id/leave` | ✓ | — | — |
| `GET /:id/members` | ✓ | — | — |
| `GET /:id/audit-logs` | ✓ | — | Last 100 |
| `PUT /:id/welcome` | ✓ | `{ welcomeMessage }` | — |

---

## 4. Database Schema

All IDs are UUID strings. All timestamps are ISO 8601.

### Core Enums

```
ConversationType: DIRECT | GROUP
ParticipantRole: MEMBER | ADMIN
MessageType: TEXT | IMAGE | AUDIO | VIDEO | FILE | POLL
MessageStatus: SENT | DELIVERED | READ
StoryType: IMAGE | VIDEO | TEXT
CommunityVisibility: PUBLIC | PRIVATE
CommunityCategory: TECHNOLOGY | GAMING | AI | BUSINESS | EDUCATION | ENTERTAINMENT | MUSIC | ANIME | SPORTS | GENERAL
VerificationStatus: NONE | OFFICIAL | VERIFIED | ORGANIZATION | GAMING
EventStatus: SCHEDULED | ONGOING | COMPLETED | CANCELLED
```

### User
```
id: String (UUID, PK)
email: String? (unique)
phone: String? (unique)
username: String? (unique, 3-30 chars, alphanumeric+underscore)
passwordHash: String?
displayName: String?
avatar: String? (URL)
bio: String? (default: "Hey there! I am using NexChat.")
publicKey: String? (JWK JSON)
fcmToken: String?
lastSeen: DateTime
lastSeenVisibility: String (default: "EVERYONE", values: EVERYONE | CONTACTS | NOBODY)
showEmail: Boolean (default: false)
readReceiptsEnabled: Boolean (default: true)
notificationsEnabled: Boolean (default: true)
notificationSound: Boolean (default: true)
createdAt: DateTime
```

### RefreshToken
```
id: String (UUID, PK)
userId: String (FK → User, cascade delete)
token: String (unique, the JWT refresh token)
expiresAt: DateTime
userAgent: String?
ip: String?
lastUsedAt: DateTime
createdAt: DateTime
Index: userId
```

### KeyBackup
```
userId: String (PK, FK → User, cascade delete)
ciphertext: String (encrypted private key blob, max 32KB)
salt: String
iv: String
iterations: Int (default: 310000)
updatedAt: DateTime
createdAt: DateTime
```

### Conversation
```
id: String (UUID, PK)
type: ConversationType (default: DIRECT)
name: String?
avatar: String?
createdAt: DateTime
updatedAt: DateTime
disappearingTtlSeconds: Int? (TTL in seconds for disappearing messages)
description: String?
isAnnouncementMode: Boolean (default: false) — only admins can post
requiresApproval: Boolean (default: false) — join requests
isPublic: Boolean (default: false)
invitePermission: String (default: "EVERYONE")
messagePermission: String (default: "EVERYONE")
editPermission: String (default: "ADMINS")
```

### Participant (join table: User ↔ Conversation + per-user chat state)
```
id: String (UUID, PK)
userId: String (FK → User)
conversationId: String (FK → Conversation)
role: ParticipantRole (default: MEMBER)
joinedAt: DateTime
readWatermarkId: String? (ID of last-read message)
deliveredWatermarkId: String?
clearedAt: DateTime? (when user "cleared" the chat)
pinnedAt: DateTime?
mutedUntil: DateTime?
archivedAt: DateTime?
notificationPreference: String (default: "ALL", values: ALL | MENTIONS_ONLY | MUTE)
Unique: [userId, conversationId]
```

### GroupInvite
```
id: String (UUID, PK)
token: String (unique, random 32 hex)
conversationId: String (FK → Conversation)
createdById: String (FK → User)
expiresAt: DateTime?
maxUses: Int?
useCount: Int (default: 0)
revoked: Boolean (default: false)
createdAt: DateTime
Index: conversationId
```

### JoinRequest
```
id: String (UUID, PK)
conversationId: String (FK → Conversation)
userId: String (FK → User)
status: String (default: "PENDING", values: PENDING | APPROVED | REJECTED)
createdAt: DateTime
Unique: [conversationId, userId]
```

### GroupAuditLog
```
id: String (UUID, PK)
conversationId: String (FK → Conversation)
actorId: String (FK → User)
action: String (CREATE | JOIN | LEAVE | ROLE_CHANGE | SETTINGS_EDIT | MEMBER_REMOVE | MEMBER_ADD | REQUEST_APPROVE | REQUEST_REJECT)
targetId: String?
target: User? (FK → User)
details: String?
createdAt: DateTime
```

### Message
```
id: String (UUID, PK)
conversationId: String (FK → Conversation)
senderId: String (FK → User)
content: String (required, max 64KB after encryption envelope)
type: MessageType (default: TEXT)
mediaUrl: String?
status: MessageStatus (default: SENT)
createdAt: DateTime
replyToId: String? (self-FK, set null on delete)
isDeleted: Boolean (default: false)
forwardedFromId: String? (self-FK, set null on delete)
editedAt: DateTime?
mentionedUserIds: String[] (scalar array)
expiresAt: DateTime? (disappearing message)
scheduledAt: DateTime? (scheduled send)
pollOptionCount: Int? (2-12 for POLL type)
pinnedAt: DateTime?
pinnedById: String?
highlightScore: Int (default: 0)
Indexes: [createdAt], [expiresAt], [scheduledAt], [conversationId, pinnedAt]
```

### PollVote
```
id: String (UUID, PK)
messageId: String (FK → Message)
userId: String (FK → User)
optionIndex: Int
createdAt: DateTime
Unique: [messageId, userId]
Index: messageId
```

### Star (per-user starred messages)
```
id: String (UUID, PK)
messageId: String (FK → Message)
userId: String (FK → User)
createdAt: DateTime
Unique: [messageId, userId]
Index: userId
```

### Reaction
```
id: String (UUID, PK)
messageId: String (FK → Message)
userId: String (FK → User)
emoji: String
createdAt: DateTime
Unique: [messageId, userId, emoji]
Index: messageId
```

### MessageRead (read receipts)
```
id: String (UUID, PK)
messageId: String (FK → Message)
userId: String (FK → User)
readAt: DateTime
Unique: [messageId, userId]
```

### MessageDelete (per-user "delete for me")
```
id: String (UUID, PK)
messageId: String (FK → Message)
userId: String (FK → User)
deletedAt: DateTime
Unique: [messageId, userId]
```

### Block
```
id: String (UUID, PK)
blockerId: String (FK → User)
blockedId: String (FK → User)
createdAt: DateTime
Unique: [blockerId, blockedId]
```

### Friendship
```
id: String (UUID, PK)
userId: String (FK → User)
friendId: String (FK → User)
createdAt: DateTime
Unique: [userId, friendId]
Index: userId, friendId
```

### FriendRequest
```
id: String (UUID, PK)
senderId: String (FK → User)
receiverId: String (FK → User)
status: String (default: "PENDING", values: PENDING | ACCEPTED | REJECTED)
createdAt: DateTime
updatedAt: DateTime
Unique: [senderId, receiverId]
Index: receiverId, senderId
```

### Report (user-on-user)
```
id: String (UUID, PK)
reporterId: String (FK → User)
reportedId: String (FK → User)
reason: String
description: String?
createdAt: DateTime
```

### Story
```
id: String (UUID, PK)
userId: String (FK → User)
type: StoryType
mediaUrl: String?
caption: String? (max 700 chars)
bgColor: String? (hex, linear-gradient, or radial-gradient)
fontStyle: String?
createdAt: DateTime
expiresAt: DateTime (always createdAt + 24 hours)
Index: userId, expiresAt
```

### StoryView
```
id: String (UUID, PK)
storyId: String (FK → Story)
viewerId: String (FK → User)
viewedAt: DateTime
Unique: [storyId, viewerId]
Index: storyId
```

### StoryReaction
```
id: String (UUID, PK)
storyId: String (FK → Story)
userId: String (FK → User)
emoji: String
createdAt: DateTime
Unique: [storyId, userId]
Index: storyId
```

### Community (1:1 with Conversation)
```
id: String (UUID, PK)
conversationId: String (unique, FK → Conversation)
visibility: CommunityVisibility (default: PRIVATE)
category: CommunityCategory?
tags: String[] (default: [])
banner: String? (URL)
website: String?
socialLinks: Json? (default: "[]")
rules: String?
verificationStatus: VerificationStatus (default: NONE)
verifiedAt: DateTime?
customUrl: String? (unique, 3-32 lowercase alphanumeric+hyphens)
welcomeMessage: String?
reputationScore: Float (default: 0)
ratingAverage: Float (default: 0)
ratingCount: Int (default: 0)
totalMessages: Int (default: 0)
totalMembersEver: Int (default: 0)
weeklyActiveMembers: Int (default: 0)
growthRate: Float (default: 0)
engagementScore: Float (default: 0)
highlightCount: Int (default: 0)
createdAt: DateTime
updatedAt: DateTime
Indexes: [visibility, category], [reputationScore], [engagementScore], [growthRate], [customUrl]
```

### CustomRole
```
id: String (UUID, PK)
communityId: String (FK → Community)
name: String
color: String (default: "#5865F2")
permissions: BigInt (default: 0, bitfield)
priority: Int (default: 0)
createdAt: DateTime
Unique: [communityId, name]
Index: communityId
```

### CustomRoleMember
```
id: String (UUID, PK)
roleId: String (FK → CustomRole)
participantId: String (unique, FK → Participant)
assignedAt: DateTime
Index: roleId
```

### CommunityEvent
```
id: String (UUID, PK)
communityId: String (FK → Community)
title: String
description: String?
type: String (default: "MEETING")
startsAt: DateTime
endsAt: DateTime?
maxAttendees: Int?
createdById: String (FK → User)
status: EventStatus (default: SCHEDULED)
createdAt: DateTime
updatedAt: DateTime
Indexes: [communityId, status], [startsAt]
```

### CommunityEventAttendee
```
id: String (UUID, PK)
eventId: String (FK → CommunityEvent)
userId: String (FK → User)
rsvp: String (default: "GOING", values: GOING | MAYBE | DECLINED)
reminded: Boolean (default: false)
createdAt: DateTime
Unique: [eventId, userId]
```

### CommunityRating
```
id: String (UUID, PK)
communityId: String (FK → Community)
userId: String (FK → User)
score: Int (1-5)
review: String?
createdAt: DateTime
Unique: [communityId, userId]
Index: [communityId, score]
```

### CommunityAchievement
```
id: String (UUID, PK)
communityId: String (FK → Community)
type: String
label: String
icon: String
unlockedAt: DateTime
data: Json?
Unique: [communityId, type]
Index: communityId
```

### CommunityHighlight
```
id: String (UUID, PK)
communityId: String (FK → Community)
messageId: String (FK → Message)
reactionCount: Int (default: 0)
promotedBy: String (user ID)
createdAt: DateTime
Unique: [communityId, messageId]
Index: [communityId, reactionCount]
```

### CommunityLeaderboardEntry
```
id: String (UUID, PK)
communityId: String (FK → Community)
period: String
type: String
rank: Int
userId: String (FK → User)
score: Int
metadata: Json?
weekStart: DateTime?
monthStart: DateTime?
createdAt: DateTime
Index: [communityId, period, type, rank]
```

### CommunityAuditLog
```
id: String (UUID, PK)
communityId: String (FK → Community)
actorId: String (FK → User)
action: String
details: Json?
createdAt: DateTime
Index: [communityId, createdAt]
```

### ModSettings (1:1 with Community)
```
id: String (UUID, PK)
communityId: String (unique, FK → Community)
profanityFilter: Boolean (default: true)
spamDetection: Boolean (default: true)
linkProtection: Boolean (default: false)
slowModeSeconds: Int (default: 0)
capsLimit: Int (default: 0)
repeatedCharLimit: Int (default: 0)
minAccountAgeDays: Int (default: 0)
requireVerifiedEmail: Boolean (default: false)
maxJoinsPerMinute: Int (default: 10)
autoKickOnJoinRaid: Boolean (default: false)
allowedDomains: String[] (default: [])
createdAt: DateTime
updatedAt: DateTime
```

### CommunityBan
```
id: String (UUID, PK)
communityId: String (FK → Community)
userId: String (FK → User)
reason: String?
bannedById: String (FK → User)
expiresAt: DateTime?
createdAt: DateTime
Unique: [communityId, userId]
Index: communityId
```

### CommunityReport
```
id: String (UUID, PK)
communityId: String (FK → Community)
reporterId: String (FK → User)
targetType: String (MESSAGE | USER)
targetId: String
reason: String
description: String?
status: String (default: "OPEN", values: OPEN | RESOLVED | DISMISSED)
resolverId: String? (FK → User)
resolution: String?
createdAt: DateTime
updatedAt: DateTime
Indexes: [communityId, status], [targetType, targetId]
```

### ModAction
```
id: String (UUID, PK)
communityId: String (FK → Community)
action: String (MUTE | KICK | BAN | WARN | UNBAN)
moderatorId: String (FK → User)
targetId: String (FK → User)
reason: String?
durationMs: Int?
expiresAt: DateTime?
createdAt: DateTime
Indexes: [communityId, createdAt], [targetId]
```

---

## 5. WebSocket / Socket.IO Events

### Connection

- **Protocol:** Socket.IO 4.8
- **Auth:** `socket.handshake.auth.token` = JWT access token (15 min expiry)
- **Server verifies:** `jwt.verify(token, JWT_ACCESS_SECRET)` → extracts `{ id }` → `socket.data.userId`
- **On connect:** socket joins room `user:{userId}` automatically
- **Redis adapter:** Horizontal scaling via Redis pub/sub

### Client → Server Events

| Event | Payload | Behavior |
|---|---|---|
| `join_conversation` | `conversationId: string` | Joins the conversation room |
| `leave_conversation` | `conversationId: string` | Leaves the conversation room |
| `send_message` | `{ conversationId, message }` | Relays to conversation room (except sender). Throttled. |
| `typing:start` | `{ conversationId, userId, displayName }` | Relays to conversation room. Throttled. |
| `typing:stop` | `{ conversationId, userId }` | Relays to conversation room. Throttled. |
| `heartbeat` | — | Renews presence lease (30s). Client must send every ≤25s. |
| `community:join` | `communityId: string` | Joins `community:{communityId}` room |
| `community:leave` | `communityId: string` | Leaves `community:{communityId}` room |

**Throttling:** Token bucket per socket: 120 burst, 2/sec refill. 200 consecutive drops → disconnect.

### Server → Client Events

#### Personal Room (`user:{userId}`) — receive nearly everything

| Event | Payload | Fires when |
|---|---|---|
| `message:new` | Full message object (with `sender`, `replyTo`) | New message created, forwarded, or scheduled message fired |
| `message:deleted_everyone` | Updated message (isDeleted: true) | Delete for everyone |
| `message:reaction` | `{ conversationId, messageId, userId, emoji, action: "add"|"remove" }` | Reaction toggled |
| `message:pin` | `{ conversationId, messageId, pinned, pinnedById }` | Pin toggled |
| `message:edited` | Updated message object | Message edited |
| `message:expired` | `{ conversationId, messageId }` | Expiry sweep deleted message |
| `poll:voted` | `{ conversationId, messageId, userId, optionIndex }` | Poll vote cast/changed |
| `messages:read_watermark` | `{ conversationId, readByUserId, watermarkId, watermarkTime }` | Read receipts (honors readReceiptsEnabled privacy) |
| `messages:delivered` | `{ conversationId, deliveredToUserId }` | SENT→DELIVERED on connect |
| `conversation:updated` | Full conversation payload | Group settings changed |
| `conversation:participants_added` | Full conversation payload | Members added / join approved |
| `conversation:removed` | `{ conversationId }` | You were removed / you left |
| `conversation:participant_removed` | `{ conversationId, removedUserId, conversation }` | Other member left/removed |
| `conversation:role_changed` | `{ conversationId, userId, role, conversation }` | Role changed |
| `conversation:pin_toggled` | `{ conversationId, pinnedAt }` | You pinned/unpinned |
| `conversation:disappearing_changed` | `{ conversationId, ttlSeconds }` | TTL changed |
| `conversation:mute_toggled` | `{ conversationId, mutedUntil }` | You muted/unmuted |
| `conversation:archive_toggled` | `{ conversationId, archivedAt }` | Archived/unarchived |
| `group:join_request_created` | `{ conversationId, request }` | Admin-only: join request pending |
| `group:join_request_resolved` | `{ conversationId, status, conversation? }` | Requester: approved/rejected |
| `story:new` | Full story object (with `user`) | Contact posted a story |
| `story:reaction` | `{ storyId, emoji, user }` | Someone reacted to your story |
| `story:deleted` | `{ storyId, userId }` | Contact deleted a story |
| `community:updated` | `{ communityId }` | Community profile changed |

#### Global broadcast (all sockets)

| Event | Payload | Fires when |
|---|---|---|
| `user:presence` | `{ userId, isOnline: boolean, lastSeen? }` | Online/offline transition |

#### Community room (`community:{communityId}`)

| Event | Payload | Fires when |
|---|---|---|
| `community:visibility_changed` | `{ communityId, visibility }` | Visibility changed |
| `community:event_created` | Full event object | Event created |
| `community:event_updated` | Full event object | Event updated |
| `community:event_cancelled` | `{ eventId }` | Event cancelled |
| `community:rating_added` | `{ communityId, userId }` | Rating added |
| `community:highlight_added` | Full highlight object | Highlight promoted |
| `community:highlight_removed` | `{ highlightId }` | Highlight removed |
| `community:member_joined` | `{ communityId, userId }` | Member joined |
| `community:member_left` | `{ communityId, userId }` | Member left |

### Room Summary

| Room Pattern | Joined by | Used for |
|---|---|---|
| `user:{userId}` | Auto on connect | Everything: messages, reactions, pins, edits, conversations, stories, community updates, polls, read receipts, delivery, expiries |
| `{conversationId}` (raw) | `join_conversation` event | Socket relay only: `receive_message`, `typing:start`, `typing:stop` |
| `community:{communityId}` | `community:join` event | Community broadcasts: events, ratings, highlights, members, visibility |
| Global (no room) | — | `user:presence` only |

---

## 6. Authentication System

### Flow

1. **Register:** Send OTP → Verify OTP → Register with credentials → Receive tokens
2. **Login (password):** Send credentials → Receive tokens
3. **Login (OTP):** Send OTP → Verify OTP → Login with code → Receive tokens
4. **Token refresh:** POST refresh endpoint with refresh token → Receive new access+refresh (rotation)
5. **Logout:** POST logout with refresh token → Server deletes it

### Token Storage on Android

- Use `EncryptedSharedPreferences` (AndroidX Security)
- Keys: `chat_user` (JSON), `chat_access_token`, `chat_refresh_token`
- On logout: clear all three

### Axios Interceptor Equivalent (OkHttp)

- **Request interceptor:** Attach `Authorization: Bearer {accessToken}` to every request
- **Response interceptor:** On 401, queue the request, refresh tokens, retry. If refresh fails → clear auth → redirect to login
- On 429: Show toast with retry-after message

### Device Sessions

- Each refresh token stores `userAgent` and `ip`
- The access token payload includes `sid` (session ID = refresh token row ID)
- `GET /api/users/sessions` returns all sessions, marking the current one via `sid` match
- `DELETE /api/users/sessions/:id` revokes a specific session
- `POST /api/users/sessions/revoke-others` revokes all except current

---

## 7. End-to-End Encryption

### Algorithm Details

| Component | Algorithm | Parameters |
|---|---|---|
| Key pair | RSA-OAEP | 2048-bit, SHA-256 |
| Message encryption | AES-GCM | 256-bit |
| IV | Random | 12 bytes |
| Key backup wrap | PBKDF2 → AES-GCM | 310,000 iterations, SHA-256, 256-bit key |

### Key Generation

1. Generate RSA-OAEP 2048-bit key pair (encrypt + decrypt)
2. Store private key locally (IndexedDB on web → EncryptedSharedPreferences / Android Keystore on Android)
3. Export public key as JWK JSON → POST to `POST /api/users/public-key`

### Encryption Flow (sender)

1. Generate random AES-256-GCM key
2. Generate random 12-byte IV
3. Encrypt plaintext with AES-GCM → ciphertext
4. For each participant: encrypt AES key with their RSA public key → per-user encrypted key
5. Package: `{ isEncrypted: true, iv, ciphertext, keys: { [userId]: encryptedAesKey } }`
6. Send this JSON string as `content` in the message API

### Decryption Flow (receiver)

1. Parse `content` JSON → check `isEncrypted === true`
2. Extract own encrypted AES key from `keys[currentUserId]`
3. Decrypt AES key with own RSA private key
4. Decrypt ciphertext with AES key + IV
5. If private key missing: show `[Decryption failed: Private key missing on this device]`

### Key Backup

- Export private key as JWK
- Derive wrapping key from user passphrase via PBKDF2 (310K iterations, random salt)
- Encrypt JWK with AES-GCM → `{ ciphertext, salt, iv, iterations }`
- Store server-side via `PUT /api/users/me/key-backup`

### Key Restore

- Fetch backup from `GET /api/users/me/key-backup`
- User enters passphrase → derive key via PBKDF2 → decrypt ciphertext → import private key JWK

### Android Implementation Notes

- Use `java.security.KeyPairGenerator` with `RSA/ECB/OAEPWithSHA-256AndMGF1Padding`
- Use `javax.crypto.Cipher` with `AES/GCM/NoPadding`
- Use `javax.crypto.SecretKeyFactory` with `PBKDF2WithHmacSHA256`
- Store private key in Android Keystore (hardware-backed if available)

---

## 8. Media System

### Upload Flow

```
Client                          Server
  │                                │
  ├──POST /media/presigned-url─────┤
  │  { fileName, fileType,         │
  │    fileSize }                   │
  │                                │
  │←──{ uploadUrl, publicUrl }─────┤
  │                                │
  ├──PUT {uploadUrl}───────────────┤  (raw binary, no auth header)
  │  (binary body)                 │
  │                                │
  │←──{ success: true }────────────┤
  │                                │
  ├──Use publicUrl in message──────┤
```

- Grant stored in Redis for 10 minutes
- Public URL format: `SERVER_URL/uploads/{timestamp}-{encoded_filename}`

### Supported Types

| Category | MIME Types | Max Size |
|---|---|---|
| Image | jpeg, png, gif, webp, avif, heic, heif, svg+xml | 10 MB |
| Video | mp4, webm, quicktime, x-matroska | 50 MB |
| Audio | mpeg, mp4, aac, ogg, webm, wav, x-m4a | 16 MB |
| Document | pdf, zip, doc, docx, xls, xlsx, ppt, pptx, txt, csv | 50 MB |

### Voice Messages

- Record audio (webm/opus or aac)
- Upload via presigned URL
- Store as AUDIO type message
- Play in-app via ExoPlayer

---

## 9. Notification System

### FCM Push Notifications

- Client registers FCM token via `POST /api/users/fcm-token`
- Server sends push to offline, non-muted participants
- Payload: `{ conversationId, messageId, type: "new_message" }`
- Notification title: sender's displayName
- Notification body: text content, or "Sent a photo/video/audio/file"
- Stale tokens (messaging/registration-token-not-registered) are auto-cleared

### Notification Rules

- Skip sender themselves
- Skip users who are currently online (presence check)
- Skip users with `notificationPreference === "MUTE"`
- Skip users with `notificationPreference === "MENTIONS_ONLY"` unless mentioned
- Skip users with `mutedUntil > now` unless mentioned
- Skip users with `notificationsEnabled === false`
- Mentioned users bypass mute (but not global disable)

### Android Implementation

- Create notification channel: "messages"
- Handle data-only payload (no notification payload — for background processing)
- On notification tap: open conversation
- Support quick reply via notification action

---

## 10. UI Screens & Navigation

### Routes

| Path | Screen | Auth Required |
|---|---|---|
| `/auth` | AuthPage (login/register) | No (redirect to /chat if logged in) |
| `/chat` | ChatPage (main app) | Yes |
| `/forgot-password` | ForgotPasswordPage | No |
| `/reset-password` | ResetPasswordPage | No |
| `/invite/:token` | JoinGroupPage | Yes |
| `/u/:username` | InviteResolver (username lookup) | No |
| `/explore` | ExplorePage (community discovery) | Yes |
| `/community/:id` | CommunityPage | Yes |
| `*` | NotFoundPage | No |

### Screen Inventory

#### Auth Flow
1. **AuthPage** — Login/Register toggle, phone/email input, password, OTP verification step
2. **ForgotPasswordPage** — Email input → sends reset link
3. **ResetPasswordPage** — New password input (token from URL)

#### Main Chat
4. **ChatPage** — Two-panel layout: Sidebar + ChatWindow
5. **Sidebar** — SearchBar, FriendStatusBar, StoriesBar, ConversationList
6. **ConversationItem** — Avatar, name, last message preview, unread badge, time, pinned/muted indicators
7. **ChatWindow** — ChatHeader + MessageList + MessageInput
8. **ChatHeader** — Avatar, name, online status, action buttons (search, pin, mute, call, more)
9. **MessageList** — Virtualized list, grouped by date, auto-scroll, load-more on scroll-up
10. **MessageBubble** — Content, sender name (groups), time, status ticks, reactions, reply-to preview, forwarded tag, poll, voice message
11. **MessageInput** — Text input, attachment button, emoji picker, voice record button, send button, mention autocomplete

#### Modals/Sheets
12. **ContactInfoModal** — User profile (DM) or group info (GROUP)
13. **ContactInfoModalBody** — Avatar, name, bio, online status, mutual friends, actions
14. **ProfileModal** — Edit own profile (display name, avatar, bio, username, settings)
15. **ForwardModal** — Select conversation to forward message
16. **NewChatModal** — Search users, start new DM
17. **NewGroupModal** — Select participants, set name/avatar
18. **InviteManager** — Create/revoke group invite links
19. **FriendRequestsModal** — View/send/accept/reject friend requests
20. **PinnedMessagesModal** — List pinned messages in conversation
21. **StarredMessagesModal** — List starred messages across all conversations
22. **ScheduledPanel** — View/cancel scheduled messages
23. **MediaGallery** — View all media in conversation (images, videos, documents)
24. **PollComposer** — Create poll with 2-12 options
25. **PollMessage** — Render poll with vote counts and bars
26. **PollVotesSheet** — Who voted for which option
27. **ReactionDetailSheet** — Who reacted with what emoji
28. **ReadReceiptSheet** — Read/delivered status for sent messages
29. **KeyBackupSection** — Backup/restore encryption keys with passphrase

#### Stories
30. **StoriesBar** — Horizontal scrollable story circles at top of sidebar
31. **StoryRing** — Colored ring around avatar (gradient if unviewed)
32. **StoryViewer** — Full-screen story viewer (tap to advance, swipe, auto-progress, reaction bar, viewer list)
33. **CreateStoryModal** — Camera/gallery picker, text editor with bg color/font

#### Communities
34. **ExplorePage** — Trending, featured, search, category filter, recommendations
35. **CommunityPage** — Community profile, chat, events, members, settings, moderation

#### Chat Features
36. **TypingIndicator** — Animated dots when other user is typing
37. **ScrollToBottom** — FAB when scrolled up
38. **SelectionBar** — Multi-select mode for messages (forward, delete, star)
39. **SearchResults** — In-chat search results
40. **LinkPreviewCard** — Rich preview for URLs in messages
41. **DisappearingTimer** — Visual indicator for disappearing messages
42. **VoiceMessageBubble** — Play/pause, waveform visualization
43. **EmptyChat** — Placeholder when no conversation selected

#### Skeletons (Loading States)
44. FullPageSkeleton, SidebarSkeleton, ConversationItemSkeleton, ChatHeaderSkeleton, MessageListSkeleton, ChatSkeleton, ProfileSkeleton

#### Layout
45. **AppLayout** — Main layout wrapper
46. **Avatar** — User avatar with online indicator
47. **PageTransition** — Animated page transitions
48. **ToastHost** — Global toast notifications
49. **ErrorBoundary** — Error boundary wrapper
50. **AppLockGate** — PIN/biometric gate before app access
51. **KeyRestoreGate** — Prompts for passphrase to restore E2E keys

---

## 11. State Management Architecture

### Stores (use Zustand on web → use StateFlow + ViewModel on Android)

#### AuthStore
```kotlin
data class AuthState(
    val user: User?,
    val accessToken: String?,
    val refreshToken: String?
)
// Actions: setAuth(user, accessToken, refreshToken), updateUser(user), clearAuth()
// Persisted to EncryptedSharedPreferences
```

#### ConversationStore
```kotlin
data class ConversationState(
    val activeConversation: Conversation?,
    val blockedUserIds: List<String>,
    val scrollToMessageId: String?
)
// Actions: setActiveConversation(), fetchBlockedUsers(), blockUser(), unblockUser()
```

#### SocketStore
```kotlin
data class SocketState(
    val connected: Boolean,
    val socket: Socket?
)
// Actions: setConnected(), setSocket()
```

#### MessageQueueStore
```kotlin
data class QueuedMessage(
    val tempId: String,
    val conversationId: String,
    val payload: SendMessagePayload,
    val error: String?,
    val retryCount: Int,
    val queuedAt: Long
)
// Actions: enqueue(), remove(), forConversation()
// Persisted to localStorage (Android: Room DB)
```

#### UIStore
```kotlin
// Manages: active modal, selected messages, search state, sidebar visibility
```

#### LockStore
```kotlin
// Manages: app lock state, PIN verification
```

### Message Lifecycle

```
PENDING → (optimistic UI, shown immediately)
  ↓ send via API
SENT → (server confirmed, persisted)
  ↓ recipient comes online / connect
DELIVERED → (recipient's device received)
  ↓ recipient reads
READ → (recipient opened the chat)

FAILED → (network error / server error)
  ↓ retry
QUEUED → (in messageQueue, auto-retry when online)
```

### Optimistic UI

1. User taps send
2. Message appears instantly with status `PENDING`
3. Assign `tempId` (UUID)
4. Encrypt → POST to API
5. On success: replace tempId with real ID, status → SENT
6. On failure: status → FAILED, enqueue in MessageQueue
7. When user scrolls to bottom and new `message:new` arrives for own conversation, replace optimistic message

---

## 12. Feature Inventory

### Core Messaging
- [x] Private (1:1) chat
- [x] Group chat
- [x] Real-time messaging via Socket.IO
- [x] Message types: TEXT, IMAGE, AUDIO, VIDEO, FILE, POLL
- [x] Send, receive, reply, forward, edit, delete (me/everyone)
- [x] Message status: SENT → DELIVERED → READ (3-state ticks)
- [x] Read receipts (with privacy toggle)
- [x] Typing indicators
- [x] Online presence (30s heartbeat, 15s debounce)
- [x] Unread counts per conversation
- [x] Message reactions (emoji)
- [x] Pinned messages (conversation-wide)
- [x] Starred messages (per-user)
- [x] Message search (per-conversation and global)
- [x] @mentions (per-user and @everyone for admins)
- [x] Disappearing messages (configurable TTL)
- [x] Scheduled messages (up to 30 days)
- [x] Link previews
- [x] Translation (Google Translate proxy)

### Social
- [x] Friends system (request, accept, reject, cancel, remove)
- [x] User search (by name, email, phone)
- [x] User blocking/unblocking
- [x] User profiles (avatar, bio, username)

### Groups
- [x] Create group
- [x] Group settings (name, avatar, description, announcement mode, approval, public)
- [x] Invite links (with expiry, max uses, revoke)
- [x] Join approval flow
- [x] Participant management (add, remove, role change)
- [x] Admin handover (auto-promote oldest member)
- [x] Group audit log
- [x] Notification preferences per group

### Stories
- [x] Create story (IMAGE, VIDEO, TEXT)
- [x] Stories bar (24h expiry, colored rings)
- [x] Story viewer (fullscreen, tap, swipe, auto-progress)
- [x] View tracking
- [x] Story reactions (👍❤️😂😮😢🔥)
- [x] Viewer list (owner only)

### Communities
- [x] Promote group to community
- [x] Community profile (banner, website, social links, rules, tags, welcome message)
- [x] Visibility (PUBLIC/PRIVATE), category, custom URL
- [x] Explore (trending, featured, search, category filter)
- [x] Recommendations (based on joined community tags)
- [x] Custom roles (name, color, permissions bitfield, priority)
- [x] Events (create, update, cancel, RSVP)
- [x] Ratings (1-5 with review)
- [x] Highlights (promote messages)
- [x] Achievements
- [x] Leaderboards
- [x] Analytics (admin)
- [x] Moderation settings (profanity filter, spam detection, slow mode, etc.)
- [x] Mod actions (mute, kick, ban, warn, unban)
- [x] Reports (message/user, open/resolve)
- [x] Community audit logs
- [x] Join/leave
- [x] Member list
- [x] Welcome message

### Media
- [x] File upload (presigned URL flow)
- [x] Image/video/audio/document support
- [x] Media gallery (per-conversation)
- [x] Voice messages
- [x] In-app media viewer (NOT external browser)

### Security
- [x] JWT access + refresh tokens with rotation
- [x] E2E encryption (RSA-OAEP + AES-GCM)
- [x] Key backup & restore (PBKDF2 passphrase)
- [x] Device sessions (list, revoke, revoke-others)
- [x] User blocking
- [x] Account deletion

### Notifications
- [x] FCM push notifications
- [x] Notification channels
- [x] Per-conversation notification preferences (ALL / MENTIONS_ONLY / MUTE)
- [x] Global notification toggle
- [x] Mention bypass (but not global disable)

### Settings
- [x] Profile editing
- [x] Last seen visibility
- [x] Read receipts toggle
- [x] Notification settings
- [x] App lock (PIN)
- [x] Theme

---

## 13. Business Logic & Rules

### Message Visibility
- Messages are hidden if they are in `deletedFromUsers` for the current user
- Messages before `clearedAt` timestamp are hidden
- Scheduled messages are hidden from listing until fired
- Disappearing messages are hard-deleted when `expiresAt` passes (60s sweep interval)

### Conversation List Sorting
- Pinned conversations first (sorted by pinnedAt desc)
- Then by updatedAt desc (last message time)
- DIRECT chats with clearedAt and no new messages are hidden

### Group Admin Rules
- Only admins can: update group settings, add/remove participants, change roles, create invites
- Only admins can post in announcement-mode groups
- Only admins can change disappearing message TTL in groups
- When last admin leaves, oldest member is auto-promoted

### Block Rules
- Blocked users cannot send messages to each other
- Blocked users are excluded from user search results
- Block is bidirectional for messaging (checked via Redis cache)

### Read Receipts
- Reader's `readReceiptsEnabled` privacy setting controls whether others see that they read
- Watermark-based: latest read message ID stored on Participant
- Broadcast via `messages:read_watermark` to all participants' personal rooms

### Presence
- Redis lease key: `presence:{userId}` with 30s TTL
- Flap debounce: `presence:flap_timer:{userId}` with 15s TTL
- On disconnect: start 15s timer; if no heartbeat, mark offline
- Client must heartbeat every ≤25 seconds

---

## 14. Project Structure

```
NexChatAndroid/
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/nexchat/
│       │   ├── NexChatApp.kt                    # Application class (Hilt)
│       │   ├── MainActivity.kt
│       │   │
│       │   ├── di/                               # Hilt modules
│       │   │   ├── NetworkModule.kt              # Retrofit, OkHttp, auth interceptor
│       │   │   ├── DatabaseModule.kt             # Room
│       │   │   ├── SocketModule.kt               # Socket.IO
│       │   │   ├── CryptoModule.kt               # E2E crypto helpers
│       │   │   └── FirebaseModule.kt             # FCM
│       │   │
│       │   ├── data/
│       │   │   ├── local/
│       │   │   │   ├── NexChatDatabase.kt        # Room database
│       │   │   │   ├── dao/
│       │   │   │   │   ├── UserDao.kt
│       │   │   │   │   ├── ConversationDao.kt
│       │   │   │   │   ├── MessageDao.kt
│       │   │   │   │   ├── StoryDao.kt
│       │   │   │   │   ├── CommunityDao.kt
│       │   │   │   │   └── DraftDao.kt
│       │   │   │   └── entity/                   # Room entities
│       │   │   │       ├── UserEntity.kt
│       │   │   │       ├── ConversationEntity.kt
│       │   │   │       ├── ParticipantEntity.kt
│       │   │   │       ├── MessageEntity.kt
│       │   │   │       ├── ReactionEntity.kt
│       │   │   │       ├── StoryEntity.kt
│       │   │   │       └── ...
│       │   │   │
│       │   │   ├── remote/
│       │   │   │   ├── api/
│       │   │   │   │   ├── AuthApi.kt            # Retrofit interface
│       │   │   │   │   ├── UsersApi.kt
│       │   │   │   │   ├── ConversationsApi.kt
│       │   │   │   │   ├── MessagesApi.kt
│       │   │   │   │   ├── MediaApi.kt
│       │   │   │   │   ├── StoriesApi.kt
│       │   │   │   │   ├── FriendsApi.kt
│       │   │   │   │   └── CommunitiesApi.kt
│       │   │   │   ├── dto/                      # Request/Response DTOs
│       │   │   │   │   ├── ApiResponse.kt
│       │   │   │   │   ├── AuthDtos.kt
│       │   │   │   │   ├── UserDtos.kt
│       │   │   │   │   ├── ConversationDtos.kt
│       │   │   │   │   ├── MessageDtos.kt
│       │   │   │   │   └── ...
│       │   │   │   ├── interceptor/
│       │   │   │   │   ├── AuthInterceptor.kt    # Attaches Bearer token
│       │   │   │   │   └── TokenRefreshInterceptor.kt  # Handles 401 + refresh
│       │   │   │   └── websocket/
│       │   │   │       └── SocketManager.kt      # Socket.IO connection, events
│       │   │   │
│       │   │   └── repository/
│       │   │       ├── AuthRepository.kt
│       │   │       ├── UserRepository.kt
│       │   │       ├── ConversationRepository.kt
│       │   │       ├── MessageRepository.kt
│       │   │       ├── MediaRepository.kt
│       │   │       ├── StoryRepository.kt
│       │   │       ├── FriendsRepository.kt
│       │   │       ├── CommunityRepository.kt
│       │   │       └── PresenceRepository.kt
│       │   │
│       │   ├── domain/
│       │   │   ├── model/                        # Domain models
│       │   │   │   ├── User.kt
│       │   │   │   ├── Conversation.kt
│       │   │   │   ├── Message.kt
│       │   │   │   ├── Story.kt
│       │   │   │   ├── Community.kt
│       │   │   │   └── ...
│       │   │   └── usecase/                      # Business logic
│       │   │       ├── SendMessageUseCase.kt
│       │   │       ├── EncryptMessageUseCase.kt
│       │   │       ├── DecryptMessageUseCase.kt
│       │   │       └── ...
│       │   │
│       │   ├── presentation/
│       │   │   ├── navigation/
│       │   │   │   └── NexChatNavGraph.kt
│       │   │   ├── auth/
│       │   │   │   ├── AuthScreen.kt
│       │   │   │   └── AuthViewModel.kt
│       │   │   ├── chat/
│       │   │   │   ├── ChatScreen.kt
│       │   │   │   ├── ChatViewModel.kt
│       │   │   │   ├── Sidebar.kt
│       │   │   │   ├── ConversationList.kt
│       │   │   │   ├── ConversationItem.kt
│       │   │   │   ├── ChatWindow.kt
│       │   │   │   ├── ChatHeader.kt
│       │   │   │   ├── MessageList.kt
│       │   │   │   ├── MessageBubble.kt
│       │   │   │   ├── MessageInput.kt
│       │   │   │   ├── TypingIndicator.kt
│       │   │   │   ├── PollMessage.kt
│       │   │   │   └── VoiceMessageBubble.kt
│       │   │   ├── stories/
│       │   │   │   ├── StoriesBar.kt
│       │   │   │   ├── StoryViewer.kt
│       │   │   │   └── CreateStoryScreen.kt
│       │   │   ├── community/
│       │   │   │   ├── ExploreScreen.kt
│       │   │   │   ├── CommunityScreen.kt
│       │   │   │   └── CommunityViewModel.kt
│       │   │   ├── profile/
│       │   │   │   ├── ProfileScreen.kt
│       │   │   │   └── EditProfileScreen.kt
│       │   │   ├── settings/
│       │   │   │   └── SettingsScreen.kt
│       │   │   └── components/                   # Shared composables
│       │   │       ├── Avatar.kt
│       │   │       ├── AppLockGate.kt
│       │   │       ├── KeyRestoreGate.kt
│       │   │       └── ...
│       │   │
│       │   ├── crypto/
│       │   │   ├── CryptoManager.kt              # RSA + AES key generation
│       │   │   ├── KeyStoreManager.kt            # Android Keystore integration
│       │   │   ├── MessageEncryptor.kt           # Encrypt/decrypt messages
│       │   │   └── KeyBackupManager.kt           # PBKDF2 backup/restore
│       │   │
│       │   ├── service/
│       │   │   ├── FcmService.kt                 # Firebase messaging service
│       │   │   └── PresenceHeartbeatWorker.kt    # WorkManager heartbeat
│       │   │
│       │   └── util/
│       │       ├── TokenManager.kt               # Secure token storage
│       │       ├── TimeUtils.kt
│       │       └── Constants.kt
│       │
│       └── res/
│           ├── values/
│           │   ├── strings.xml
│           │   └── themes.xml
│           └── ...
│
├── build.gradle.kts                             # Project-level
├── settings.gradle.kts
└── gradle.properties
```

---

## 15. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Project setup with Hilt, Navigation, Compose
- Retrofit + OkHttp setup with auth interceptor + token refresh
- Room database setup
- Socket.IO client setup with reconnection
- Token storage (EncryptedSharedPreferences)
- Basic navigation graph

### Phase 2: Authentication (Week 2-3)
- Auth screens (login, register, OTP, forgot/reset password)
- Auth repository + ViewModel
- Token refresh flow
- Device sessions management
- App lock (PIN/biometric)

### Phase 3: Core Chat (Week 3-5)
- Conversation list with search
- Chat screen (header, message list, input)
- Real-time messaging via Socket.IO
- Message types (text, image, video, audio, file)
- Message status (ticks: sent, delivered, read)
- Typing indicators
- Reply, forward, edit, delete
- Reactions
- Pin/star messages
- Scroll to bottom FAB
- Load more (cursor pagination)

### Phase 4: E2E Encryption (Week 5-6)
- RSA-OAEP key pair generation
- Key upload to server
- Message encryption/decryption
- Key backup/restore with passphrase
- Android Keystore integration

### Phase 5: Media & Voice (Week 6-7)
- Presigned URL upload flow
- Image picker + compression
- Video picker + thumbnail
- Voice message recording + playback
- In-app media viewer (zoom, pan, swipe)
- Link preview rendering
- Translation

### Phase 6: Stories (Week 7-8)
- Stories bar
- Story creation (image, video, text)
- Story viewer (fullscreen, auto-progress)
- View tracking + reactions
- Viewer list

### Phase 7: Groups & Social (Week 8-9)
- Group creation + settings
- Invite links
- Join approval
- Friends system
- User blocking
- User profiles

### Phase 8: Communities (Week 9-11)
- Community promotion
- Explore page (trending, featured, search)
- Community profile
- Events
- Roles
- Ratings + highlights
- Moderation
- Analytics
- Leaderboards + achievements

### Phase 9: Notifications & Polish (Week 11-12)
- FCM push notifications
- Notification channels + grouping
- Quick reply
- Background presence heartbeat (WorkManager)
- Offline mode (Room caching)
- Optimistic UI
- Message queue with retry
- Performance optimization (LazyColumn, pagination, image caching)

### Phase 10: Testing & Release (Week 12-14)
- Unit tests for crypto, repositories
- UI tests for critical flows
- Performance profiling
- Memory leak detection
- ProGuard/R8 rules
- APK signing
- Play Store submission

---

## Key Implementation Notes

1. **Socket.IO Compatibility:** Use `io.socket:socket.io-client:2.1.0` (Java client). Server uses Socket.IO 4.8 with Redis adapter. Ensure handshake auth passes `{ token: accessToken }`.

2. **Token Refresh Race Condition:** Implement request queuing (same as web `failedQueue`). When 401 arrives, pause all requests, refresh token, retry all queued requests with new token.

3. **Presence Heartbeat:** Use WorkManager periodic task (every 25 seconds) to send `heartbeat` event via socket. Must work in background.

4. **E2E Crypto on Android:** Use `java.security.KeyPairGenerator` with algorithm `RSA` and `AlgorithmParameterSpec` for OAEP. For AES-GCM, use `javax.crypto.Cipher` with `GCMParameterSpec(128, iv)`.

5. **Optimistic Messages:** Insert into Room DB immediately with status PENDING + tempId. On API success, update with real ID and status SENT. On failure, update status to FAILED and enqueue.

6. **Media Viewer:** NEVER open CDN URLs in browser. Use Compose + Coil for images, ExoPlayer for videos, WebView for PDFs. Implement zoom/pan with `transformable()`.

7. **Offline Mode:** Cache conversations and messages in Room. Show cached data when offline. Queue sends in Room (messageQueue). Sync when back online.

8. **Notification Deep Link:** On notification tap, extract `conversationId` from data payload, navigate to that conversation in the chat screen.
