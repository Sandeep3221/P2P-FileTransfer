# P2P File Transfer

A blazing fast, secure, and fully decentralized Peer-to-Peer (P2P) file transfer application. Built with modern web technologies, this application allows users to share files directly between devices without storing any data on an intermediary server.

## 🚀 Features

- **Direct Peer-to-Peer Transfer**: Files are transferred directly between clients using WebRTC. No files are stored on any servers.
- **Fast & Secure**: Utilizes WebRTC `RTCDataChannel` for high-speed, encrypted data transfer.
- **QR Code Pairing**: Effortlessly connect devices by scanning a QR code or sharing a link.
- **Real-time Signaling**: Uses WebSockets for lightning-fast exchange of connection metadata (SDP/ICE).
- **Responsive & Modern UI**: Built with Next.js, React 19, and Tailwind CSS for a seamless experience on any device.

---

## 🏗 Architecture & Codebase

The project is structured as a monorepo consisting of two main components: the **Frontend** and the **Backend (Signaling Server)**.

### 1. Frontend (`/frontend`)
The frontend is a modern web application responsible for the user interface, reading files, generating WebRTC connections, and handling the direct data transfer.

- **Framework**: Next.js (React 19) powered by Turbopack for rapid development.
- **Styling**: Tailwind CSS with `radix-ui` and `lucide-react` for beautiful, accessible components.
- **WebRTC Implementation (`lib/webrtcPeer.ts`)**: 
  - Manages `RTCPeerConnection` and `RTCDataChannel`.
  - Handles the chunking of large files (using `ArrayBuffer`) and monitors `bufferedAmountLowThreshold` to prevent memory overflow during massive transfers.
  - Uses STUN (`stun.l.google.com`) for NAT traversal to discover public IP addresses and establish direct connections.
- **Utilities**: Uses `qrcode` for link generation, `html5-qrcode` for scanning, and `jszip` if folder/multiple file zipping is involved.

### 2. Backend (`/backend`)
The backend is a lightweight **Signaling Server**. It does *not* touch or see the files being transferred. Its sole purpose is to help the two peers find each other on the internet.

- **Framework**: Node.js with Express.
- **WebSockets (`ws`)**: Maintains persistent, low-latency connections to relay WebRTC signaling data.
- **Signaling Flow**:
  1. **Room Creation**: User A creates a unique session.
  2. **Joining**: User B connects to the same session via a shared link/QR.
  3. **Offer/Answer Exchange**: User A creates an SDP Offer, sends it via WebSockets to User B. User B responds with an SDP Answer.
  4. **ICE Candidate Exchange**: Both users discover their network routes (via STUN) and exchange ICE candidates through the WebSocket.
- **Security**: Hardened with `helmet`, `cors`, and `express-rate-limit` to prevent abuse.

---

## 🔄 How the Transfer Flow Works

1. **Initiation**: The Sender selects a file. The frontend initializes a WebSocket connection to the backend and generates a unique session ID.
2. **Pairing**: The Receiver opens the generated link (or scans the QR code), which connects them to the exact same WebSocket session.
3. **Signaling Phase**:
   - Sender generates a WebRTC **Offer** and sends it through the backend.
   - Receiver gets the Offer, generates an **Answer**, and sends it back.
   - Both exchange **ICE Candidates** (network routing info).
4. **P2P Connection Established**: The WebRTC `RTCDataChannel` is successfully opened. The WebSocket server is no longer needed for the transfer.
5. **Data Transfer**: The file is sliced into smaller binary chunks and streamed directly from the Sender to the Receiver.
6. **Completion**: The file is fully reassembled on the Receiver's device and downloaded automatically.

---

## 💻 Getting Started (Local Development)

### Prerequisites
- Node.js (v20+ recommended)
- npm or yarn

### Setup the Backend (Signaling Server)

```bash
cd backend
npm install
npm run dev
```
The backend will run on `http://localhost:8000` (or the port defined in `.env`).

### Setup the Frontend

Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
The frontend will start using Turbopack on `http://localhost:3000`.

---

## 🌍 Deployment & Production Notes

When deploying to production, keep the following in mind:

- **HTTPS is Required**: WebRTC requires a secure context. Both your frontend and backend must be served over HTTPS/WSS in production.
- **STUN Configuration**: The application currently relies on public STUN servers (e.g., Google's STUN). This works for the vast majority of P2P connections.
- **Environment Variables**: Ensure your production frontend `.env` points to the secure WebSocket URL of your deployed backend, and your backend `.env` is configured for the production environment.
