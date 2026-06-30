# 🌌 Sferium Homes — High-Speed Sync and Mesh calling platform

Sferium Homes is a production-ready, ultra-low latency co-watching platform designed to bring people together over synchronized media. It features sub-second video state synchronization, direct peer-to-peer audio mesh connections, and structured room states.

---

## 🏗️ Architectural Overview

The application follows a full-stack distributed system design optimized for high low-latency packet transfers and linear scale-out capability:

```
                     ┌──────────────────────────────┐
                     │     Browser Clients (xN)     │
                     └──────────────┬───────────────┘
                                    │
                                    │ WebSockets (Signaling, Sync)
                                    ▼
                     ┌──────────────────────────────┐
                     │      NGINX Reverse Proxy     │
                     └──────────────┬───────────────┘
                                    │
                        ┌───────────┴───────────┐
                        │                       │
                        ▼                       ▼
           ┌────────────────────────┐       ┌────────────────────────┐
           │   FastAPI Node A       │       │   FastAPI Node B       │
           └──────────┬─────────────┘       └───────────┬────────────┘
                      │                                 │
                      └─────────────────┬───────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         │      Redis Pub/Sub Bus      │
                         └──────────────┬──────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         │   PostgreSQL Session Storage│
                         └─────────────────────────────┘
```

1. **Routing Layer (NGINX)**: Distributes connections, terminates TLS, and upgrades HTTP handshakes to WebSocket connections.
2. **Execution Nodes (FastAPI + WebSockets)**: Light, stateless nodes that maintain active connections, parse payloads, and broadcast synchronization frames.
3. **Cross-Node Bus (Redis Pub/Sub)**: Scales WebSocket channels horizontally. Broadcasts to one node propagate across the cluster using Redis channels.
4. **Relational Database (PostgreSQL)**: Serves as a persistent store for room history, access tokens, and chat records.

---

## 📡 Synchronization and Signaling Pipelines

### 1. WebSocket Sync Sequence
Sferium uses an event-based broadcast loop where the server operates as the single authoritative source of truth.

```
Client A (Play / Seek) ──[playback_change]──► FastAPI ──[Redis Publish]──► Cluster
                                                                             │
Client B (Update Video) ◄──[playback_change]──────────[Broadcast]────────────┘
```

#### Event Message Dictionary:
* **`join`**: Establishes room sessions.
  ```json
  {
    "type": "join",
    "roomId": "ROOM_A4B",
    "userId": "user_1739",
    "name": "Alex",
    "avatar": "🍿",
    "color": "#4F46E5"
  }
  ```
* **`playback_change`**: Broadcasts play/pause toggles or time seeks.
  ```json
  {
    "type": "playback_change",
    "playing": true,
    "currentTime": 42.125,
    "playbackRate": 1.0,
    "issuerId": "user_1739"
  }
  ```
* **`chat_message`**: Transmits instant chat logs with HTML sanitization on delivery.
  ```json
  {
    "type": "chat_message",
    "text": "Hello world!"
  }
  ```

---

### 2. WebRTC Peer-to-Peer Mesh Calling
Voice communication utilizes a serverless P2P mesh architecture. The FastAPI server acts solely as a signaling broker to exchange SDP descriptors.

```
Client A (Initiator) ───────[ Offer SDP ]───────► FastAPI Broker ───────[ Offer SDP ]───────► Client B
Client A             ◄──────[ Answer SDP ]─────── FastAPI Broker ◄──────[ Answer SDP ]────── Client B
Client A ◄───────────────────────── ICE Candidate Handshake ────────────────────────► Client B
Client A ◄────────────────────────────── P2P Media Grid ─────────────────────────────► Client B
```

* **Offer Forwarding**:
  ```json
  {
    "type": "webrtc_signal",
    "signalType": "offer",
    "roomId": "ROOM_A4B",
    "senderId": "user_A",
    "targetId": "user_B",
    "sdp": "v=0\r\no=alice..."
  }
  ```
* **Candidate Exchanges**:
  ```json
  {
    "type": "webrtc_signal",
    "signalType": "candidate",
    "roomId": "ROOM_A4B",
    "senderId": "user_A",
    "targetId": "user_B",
    "candidate": { "candidate": "candidate:8421...", "sdpMLineIndex": 0 }
  }
  ```

---

## 🗄️ Database Schemas

### PostgreSQL (Persistent Chat)
```sql
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(50) NOT NULL INDEX,
    user_id VARCHAR(100) NOT NULL,
    username VARCHAR(100) NOT NULL,
    user_avatar VARCHAR(50) DEFAULT '🍿',
    user_color VARCHAR(20) DEFAULT '#3B82F6',
    message_text TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Redis (Transient Room States)
Key pattern: `room:{room_id}` -> JSON payload:
```json
{
  "roomId": "ROOM_A4B",
  "videoUrl": "https://www.youtube.com/watch?v=ScMzIvxBSi4",
  "playing": false,
  "currentTime": 10.5,
  "playbackRate": 1.0,
  "anyoneCanControl": true,
  "isPublic": true,
  "members": {
    "user_1739": {
      "id": "user_1739",
      "name": "Alex",
      "avatar": "🍿",
      "color": "#4F46E5",
      "micEnabled": false,
      "isHost": true
    }
  }
}
```

---

## 🚀 Quick Start Guide (Production Docker)

To run the complete system (Frontend, Backend, Postgres, Redis, Prometheus) locally, execute:

```bash
docker-compose up --build -d
```

Services are exposed on the following ports:
* **React Web Frontend**: `http://localhost:3000`
* **FastAPI Sync Server**: `http://localhost:8000`
* **Prometheus Dashboard**: `http://localhost:9090`

---

## 🛡️ Security Measures
1. **XSS Protection**: Complete Regex HTML sanitization filters on chat inputs.
2. **WebSocket Flood Controls**: Enforces a rolling window limit of 20 packets per 5 seconds per socket connection.
3. **Graceful Disconnect Buffers**: 15-second grace periods preserve caller positions during page reloads, preventing voice dropouts.
4. **CORS Headers**: Enforced via FastAPI CORSMiddleware.
