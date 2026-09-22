# OmniMeet — Project Brain & Knowledge Base

> **OmniMeet** is a real-time, peer-to-peer video conferencing web application built with Next.js 16 (App Router), Node.js, Socket.IO, and WebRTC (`simple-peer`).

---

## 1. System Architecture

OmniMeet employs a hybrid architecture combining a Next.js frontend with an integrated Node.js HTTP server hosting both the web app and the WebRTC signaling engine on a single port.

```
                  ┌───────────────────────────────┐
                  │          OmniMeet             │
                  │   Node.js Server (Port 3000)  │
                  └──────────────┬────────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         │                                               │
         ▼                                               ▼
┌─────────────────┐                             ┌─────────────────┐
│ Next.js App     │                             │ Socket.io Server│
│ (App Router)    │                             │ (Signaling Hub) │
└────────┬────────┘                             └────────┬────────┘
         │                                               │
         │ Serves UI & Assets                            │ WebSocket Signaling
         ▼                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Client Browser / Phone                     │
│  - useSocket (reconnection & state)                             │
│  - useWebRTC (simple-peer mesh P2P)                             │
│  - UI: VideoGrid, VideoTile, Chat, Participants, ControlBar     │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 │ Direct P2P Media Streams (Audio/Video)
                                 ▼
                     [ Remote WebRTC Peers ]
```

---

## 2. Core Directory Structure

```
omnimeet/
├── app/
│   ├── layout.js              # Global HTML shell & metadata
│   ├── page.js                # Home route (renders LandingPage)
│   ├── globals.css            # Design system, theme variables & animations
│   └── room/[roomId]/
│       └── page.js            # Dynamic room route (renders MeetingRoom)
├── components/
│   ├── LandingPage.jsx        # Join code / New meeting UI
│   ├── MeetingRoom.jsx        # Primary room coordinator & layout
│   ├── VideoGrid.jsx          # Responsive video grid layout
│   ├── VideoTile.jsx          # Individual video & avatar display (audio-safe)
│   ├── ControlBar.jsx         # Mic, cam, screen share, chat & leave buttons
│   ├── ChatPanel.jsx          # In-meeting real-time text chat
│   └── ParticipantPanel.jsx   # Participant list with host controls
├── hooks/
│   ├── useSocket.js           # Socket.IO client connection manager
│   └── useWebRTC.js           # WebRTC mesh peer connection lifecycle
├── server.js                  # Custom HTTP server (Next.js + Socket.IO)
├── next.config.ts             # Next.js configuration (Turbopack, CORS, Webpack)
└── brain.md                   # This project knowledge base
```

---

## 3. Key Modules & Responsibilities

### `server.js` (Custom Root Server)
- **Why it exists:** Modern Next.js (15/16) dev server isolates API routes in worker threads, which repeatedly drop persistent WebSockets. `server.js` hosts Socket.IO directly on the root Node.js HTTP server.
- **Port:** Defaults to `3000` (or `process.env.PORT`).
- **Events Handled:**
  - `join-room`: Registers user in room map, returns current participants to newcomer, and broadcasts `user-joined`.
  - `offer`, `answer`, `ice-candidate`: Routes WebRTC signaling messages directly between peer sockets.
  - `toggle-audio`, `toggle-video`: Synchronizes remote participant media states.
  - `send-message`: Distributes chat messages with unique IDs and timestamps.
  - `mute-participant`, `kick-participant`: Host moderation actions.
  - `disconnect`: Cleans up room state and broadcasts `user-left`.

### `hooks/useSocket.js`
- Singleton client connection to the root Socket.IO instance.
- Tracks `isConnected` state.
- Exposes `emit`, `on`, and `off` helper functions.

### `hooks/useWebRTC.js`
- Manages peer-to-peer mesh connections using `simple-peer`.
- **ICE Candidate Queue:** Buffers early ICE candidates if they arrive before the SDP offer/answer is processed.
- **Stable References:** Uses `localStreamRef` to prevent unnecessary reconnections when media streams update.
- **Renegotiation:** Preserves active peer instances during track additions or screen share switches.
- **Error Filtering:** Silently ignores benign `User-Initiated Abort, reason=Close called` teardown warnings.

### `components/VideoTile.jsx`
- **Audio-Safe Design:** Keeps the `<video>` element permanently mounted in the DOM (`display: none` when camera is off) so remote audio never cuts out when video is disabled.
- **Autoplay Handling:** Calls `.play()` explicitly with `.catch()` to satisfy browser autoplay policies.
- **Avatar Fallback:** Displays initials and participant name when camera is off.

---

## 4. WebRTC Signaling Flow

1. **User A (Host)** enters room `xyz-123`:
   - Acquires local camera & mic via `getUserMedia`.
   - Emits `join-room` with `roomId: 'xyz-123'`.
   - Server registers User A as the Host.
2. **User B (Guest)** enters room `xyz-123`:
   - Acquires local camera & mic.
   - Emits `join-room` with `roomId: 'xyz-123'`.
   - Server sends `room-participants` (`[User A]`) to User B.
   - Server sends `user-joined` (`User B`) to User A.
3. **P2P Handshake:**
   - User B (initiator) creates a `Peer({ initiator: true, stream: localStream })`.
   - User B generates an SDP `offer` $\rightarrow$ sent through Socket.IO $\rightarrow$ User A receives `offer`.
   - User A creates a `Peer({ initiator: false, stream: localStream })`.
   - User A feeds the offer into `peer.signal(offer)` $\rightarrow$ generates SDP `answer`.
   - User A sends `answer` through Socket.IO $\rightarrow$ User B feeds it into `peer.signal(answer)`.
   - Both sides exchange ICE candidates via `ice-candidate` events.
4. **Connected:**
   - Both peers fire `peer.on('stream')`, passing the remote `MediaStream` to `VideoGrid` and `VideoTile`.

---

## 5. Critical Gotchas & Solutions

| Issue | Cause | Solution |
|---|---|---|
| **Rapid Connect / Disconnect Loop** | Next.js API routes run in isolated worker threads in dev mode. | Replaced `pages/api/socket.js` with `server.js` running both Next.js and Socket.IO. |
| **`OperationError: Close called`** | React 19 Strict Mode mounts and unmounts components twice in dev mode, aborting in-flight WebRTC calls. | Set `reactStrictMode: false` in `next.config.ts` and filtered benign close errors in `useWebRTC.js`. |
| **No Remote Audio When Camera Off** | `<video>` element was conditional on `videoOn`, destroying the audio track element. | Keep `<video>` permanently mounted in `VideoTile.jsx` and toggle visibility via CSS. |
| **Mobile Camera Blocked on IP** | Mobile Chrome/Safari strictly require **HTTPS** (or `localhost`) for `getUserMedia`. | Test via HTTPS tunnel (`ngrok http 3000` or `npx localtunnel --port 3000`), or enable `chrome://flags/#unsafely-treat-insecure-origin-as-secure`. |
| **Duplicate React Key Warnings** | `Date.now()` alone can collide when events fire within the same millisecond. | Append random string: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`. |

---

## 6. Development & Deployment Commands

```bash
# Start local development server (hosts both Next.js & Socket.io)
npm run dev

# Run TypeScript type check
npx tsc --noEmit

# Build production bundle
npm run build

# Start production server
npm run start

# Expose to mobile devices via HTTPS tunnel
npx localtunnel --port 3000
# or
ngrok http 3000
```
