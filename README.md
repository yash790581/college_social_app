# college_social_app
# SweetPlay - College Social Gaming Platform (Real-Time Prototype)

> "Play with your campus. Meet players beyond it when you choose."

SweetPlay is a social gaming and audio lounge platform tailored for college students. This repository contains:
1. A mobile-first, colorful homepage with matchmaking selectors.
2. A **real-time synchronized waiting lobby for Campus Impostor** powered by Socket.IO.
3. **Room-Scoped Group Text Chat** in both Campus Impostor lobbies and Voice Rooms, with rate limiting and safe DOM rendering.
4. **Audio-Only Group Voice** powered by native browser WebRTC APIs, using Socket.IO strictly for signaling.
5. **Campus Voice Rooms**: Dedicated casual audio hangout rooms with active room discovery and 1–6 participant seats.

The application is built with **Node.js**, **Express**, **EJS**, **Socket.IO**, vanilla CSS, and vanilla JavaScript.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- `npm` (included with Node.js)
- A modern WebRTC-compatible web browser (Chrome, Edge, Firefox, Safari)

### Installation
Dependencies are defined in `package.json` (`express`, `ejs`, `dotenv`, `socket.io`, and `nodemon` for development). No external database or heavy frameworks are required. Run:

```bash
npm install
```

### Environment Configuration (.env)
SweetPlay includes an `.env.example` file with configuration guidelines:

```bash
# Copy example configuration if needed
copy .env.example .env
```

* **Default STUN Configuration**: By default, SweetPlay uses public Google STUN servers (`stun:stun.l.google.com:19302`), which allows browsers on typical home Wi-Fi and open broadband networks to discover each other and connect directly.
* **Production & Cross-Network Requirement (TURN)**: In university dormitories, corporate firewalls, or cellular carriers using symmetric NAT, direct peer-to-peer WebRTC connections often cannot traverse the firewall without a **TURN relay server**. You can configure a TURN server via `ICE_SERVERS` in `.env`:
  ```env
  ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478?transport=udp","username":"your_user","credential":"your_password"}]
  ```
  *(Note: Never commit real TURN credentials to source control!)*

### Running the Application

To start the server in **development mode** with hot-reloading:
```bash
npm run dev
```

Or run in standard production mode:
```bash
npm start
```
The server will start on [http://localhost:3000](http://localhost:3000).

---

## 🎙️ Microphone & Audio Behavior

* **Audio-Only**: The WebRTC stream strictly uses `{ audio: true, video: false }`. SweetPlay **never** requests camera access or transmits video.
* **Joined Muted by Default**: When a user connects to voice, their microphone audio track is created with `enabled = false` and marked muted. This prevents accidental background noise or unwanted broadcasts when joining.
* **Explicit User Permission**: Microphone permission is **never** requested on page load. SweetPlay requests permission only after the user explicitly clicks the **"Join Voice Channel"** or **"Turn on mic"** button.
* **Microphone Controls**:
  - **Mute / Unmute**: Toggles the local microphone track on and off, broadcasting the live mute state to peers.
  - **Speaker (Deafen)**: Mutes all incoming remote peer audio elements locally without disconnecting from the call.
  - **Leave Voice**: Stops all local microphone tracks (`track.stop()`), closes active `RTCPeerConnection` instances, removes remote audio elements, and notifies room members.
* **Resilience & Error Handling**:
  - **Permission Denied**: Clear instructions for re-enabling microphone access in browser address bar settings.
  - **No Microphone Found**: Clear notice to plug in an audio device or headset.
  - **Browser Not Supported**: Friendly fallback banner for legacy browsers lacking `RTCPeerConnection` or `getUserMedia`.
  - **Signaling Boundary Validation**: The server validates that all WebRTC signaling messages (`voice:signal`) only route between authenticated members of the *exact same room*.

---

## 💬 Room-Scoped Text Chat

* **In-Memory & Temporary**: All chat messages exist in volatile server memory per room. Messages reset when the server restarts; there is no persistent database and no private direct messaging.
* **Safe DOM Rendering**: User messages are rendered strictly via `document.createElement` and `element.textContent`, preventing any HTML/XSS injection vulnerabilities.
* **Constraints & Spam Protection**:
  - **Room Membership**: The server validates that sender socket belongs to the target room before accepting messages.
  - **Length Limit**: Messages are trimmed and limited to **500 characters** (with an interactive real-time character counter in the UI).
  - **Rate Limiting**: Users sending more than 5 messages within 3 seconds, or sending messages faster than 350ms apart, receive an inline rate-limit cooldown notification.
  - **Timestamps**: Every message shows sender name, avatar, seat assignment, and timestamp.

---

## 👥 How to Try Chat & Audio with Two Browser Windows

Follow these steps to test text chat and WebRTC audio synchronization across two browser tabs or windows:

### Testing Voice Rooms (`/voice-rooms`)

1. **Window 1 (Host)**:
   - Navigate to [http://localhost:3000/voice-rooms](http://localhost:3000/voice-rooms) (or click **"Rooms"** in the bottom navigation).
   - Click **"Create Voice Lounge"** (or click a theme card like *"Quad Lo-Fi Study Table"*).
   - Enter your nickname (e.g. `Alex`) and click **"Create & Enter Lounge"**.
   - Note the room code (e.g. `LOUNGE-104`). Click **"Copy Code"** or **"Copy Link"**.

2. **Window 2 (Guest)**:
   - Open a second browser window, incognito tab, or a different browser.
   - Navigate to [http://localhost:3000/voice-rooms](http://localhost:3000/voice-rooms), click **"Join with Code"**, enter the room code (e.g. `LOUNGE-104`), and nickname `Sam`.
   - Click **"Join Lounge"**.

3. **Try Text Chat**:
   - In Window 1, type `"Hey Sam, welcome to the quad table!"` in the chat input and click **Send** (or press Enter).
   - **Observe**: Window 2 immediately receives the chat message with Alex's avatar, seat pill, timestamp, and message.
   - In Window 2, reply `"Thanks Alex, audio works great!"`.
   - Try typing a message near 500 characters to see the character counter turn amber.
   - Try sending 5 rapid messages to observe the rate-limit protection alert.

4. **Try WebRTC Voice**:
   - In Window 1, click **"Join Voice Channel"**.
   - Allow microphone access in the browser prompt.
   - Notice you join **Muted** by default (`Voice Status: 🎙️ In Voice (1) • Mic Muted`).
   - In Window 2, click **"Join Voice Channel"** and allow microphone access.
   - In Window 1, click **"Turn on mic"** (`btn-mic-live` turns emerald). Speak into your microphone—audio streams peer-to-peer to Window 2!
   - In Window 2, click **"Speaker"** to test the deafen toggle (`Speaker: Deafened`). Window 2 is immediately silenced. Click again to undeafen.
   - Click **"Leave Voice"** or close Window 2 to verify that peer connections and audio tracks are gracefully cleaned up and the seat voice badge clears.

---

### Testing Campus Impostor Lobby (`/campus-impostor`)

1. **Window 1 (Host)**:
   - Navigate to [http://localhost:3000/campus-impostor](http://localhost:3000/campus-impostor), click **"Create Room"**, enter nickname `Jordan`.
   - Seat 1 shows `👑 Host` and `You`.
2. **Window 2 & Window 3 (Guests)**:
   - Join with room code as `Taylor` and `Morgan`.
   - All players can chat freely in the **Quad Group Chat** panel.
   - All players can connect their microphones via the **Room Audio Channel** dock.
3. **Lobby Start Verification**:
   - All 3 players click **"Get Ready"**.
   - Host clicks **"🚀 Start Game (3 Players Ready)"**.
   - The celebratory **"Lobby Ready!"** banner appears across all windows.
   - Notice: **Voice audio and text chat remain active and accessible** in both the waiting lobby and the ready state!

---

## 📁 Project Architecture & File Structure

```
c:\wechat\
├── package.json          # Express, EJS, Socket.IO, Dotenv
├── .env.example          # WebRTC ICE & TURN server configuration template
├── server.js             # Express app, Socket.IO server, and router registrations
├── config/
│   └── webrtc.js         # Safe ICE server parser (STUN defaults / TURN env parsing)
├── services/
│   └── roomStore.js      # In-memory store (game & voice rooms, chat, rate limits, voice states)
├── socket/
│   └── lobbyHandler.js   # Socket.IO handler (room lifecycle, chat, and WebRTC signaling)
├── routes/
│   ├── index.js          # Homepage route
│   ├── impostor.js       # Campus Impostor mode selector and room lobby routes
│   └── voiceRooms.js     # Voice Rooms directory and lounge stage routes
├── views/
│   ├── index.ejs         # Homepage template
│   ├── impostor-modes.ejs# Impostor mode selector
│   ├── impostor-lobby.ejs# Impostor lobby with 6 seats, voice dock, and group chat
│   ├── voice-rooms.ejs   # Voice Rooms directory and modal dialogs
│   ├── voice-room.ejs    # Voice room stage with 6 seats, audio dock, and group chat
│   ├── 404.ejs           # 404 error page
│   └── partials/
│       ├── header.ejs    # Global header with Home, Impostor, and Voice Rooms links
│       └── footer.ejs    # Global footer with enabled "Rooms" bottom navigation
├── public/
│   ├── css/
│   │   ├── style.css     # Base design tokens, resets, and layout system
│   │   └── app-ui.css    # Card styles, audio dock, chat styles, and responsive layout
│   └── js/
│       ├── room-client.js# Reusable SweetPlayChat and SweetPlayVoice WebRTC client module
│       └── main.js       # UI controllers, modal handlers, and room sync glue
└── README.md             # Documentation, setup, and multi-client testing guide
```

---

## 🔒 Scope & Technical Boundaries

* **No Database or Persistent Storage**: All active rooms, chat messages, and socket memberships are temporary and held in Node.js server memory. Everything resets cleanly on server restart.
* **No Video, Cameras, or Screen Sharing**: Voice is strictly audio-only.
* **No Direct Messages**: Chat is strictly scoped to members currently inside the same room.
* **Game Round Placeholder**: The Campus Impostor game logic (secret word distribution, clue-taking rounds, voting elimination) remains a placeholder for future milestones.
* **6 Participants Limit**: Prototype rooms support up to 6 students simultaneously in mesh topology.
* **No User Accounts or Payments**: No login authentication, student ID verification, or commercial payment systems.
