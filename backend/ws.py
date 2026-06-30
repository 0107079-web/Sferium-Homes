import logging
import asyncio
import json
import time
from typing import Dict, Set, Optional, Any, List
from fastapi import WebSocket, WebSocketDisconnect
from backend.config import settings
from backend.rooms import RoomController
from backend.chat import ChatManager
from backend.webrtc import WebRTCSignaler

logger = logging.getLogger("sferium.ws")

# Structure to keep connected active WebSocket instances
# _connections[room_id][user_id] = WebSocket
_connections: Dict[str, Dict[str, WebSocket]] = {}

# Rate limit tracking structure: _anti_flood_log[user_id] = [timestamp1, timestamp2, ...]
_anti_flood_log: Dict[str, List[float]] = {}

class ConnectionManager:
    @staticmethod
    def get_active_users_in_room(room_id: str) -> List[str]:
        room_id = room_id.upper().strip()
        if room_id in _connections:
            return list(_connections[room_id].keys())
        return []

    @staticmethod
    async def add_connection(room_id: str, user_id: str, websocket: WebSocket) -> None:
        room_id = room_id.upper().strip()
        if room_id not in _connections:
            _connections[room_id] = {}
        _connections[room_id][user_id] = websocket
        logger.info(f"🔌 WebSocket connection registered. User {user_id} added to room {room_id}")

    @staticmethod
    async def remove_connection(room_id: str, user_id: str) -> None:
        room_id = room_id.upper().strip()
        if room_id in _connections and user_id in _connections[room_id]:
            del _connections[room_id][user_id]
            if not _connections[room_id]:
                del _connections[room_id]
            logger.info(f"🔌 WebSocket connection removed. User {user_id} removed from room {room_id}")

    @staticmethod
    async def send_to_user(room_id: str, user_id: str, data: dict) -> bool:
        room_id = room_id.upper().strip()
        try:
            if room_id in _connections and user_id in _connections[room_id]:
                ws = _connections[room_id][user_id]
                await ws.send_text(json.dumps(data))
                return True
        except Exception as e:
            logger.warning(f"⚠️ Direct message send failed for {user_id} in {room_id}: {e}")
            # Ensure stale connections are cleaned up
            asyncio.create_task(ConnectionManager.remove_connection(room_id, user_id))
        return False

    @staticmethod
    async def broadcast_to_room(room_id: str, data: dict, exclude_user_id: Optional[str] = None) -> None:
        room_id = room_id.upper().strip()
        if room_id not in _connections:
            return
        
        serialized = json.dumps(data)
        targets = list(_connections[room_id].items())
        
        tasks = []
        for uid, ws in targets:
            if exclude_user_id and uid == exclude_user_id:
                continue
            tasks.append(ConnectionManager._safe_send(room_id, uid, ws, serialized))
            
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    @staticmethod
    async def _safe_send(room_id: str, user_id: str, ws: WebSocket, serialized_data: str) -> None:
        try:
            await ws.send_text(serialized_data)
        except Exception as e:
            logger.warning(f"Failed broadcasting to {user_id} in {room_id}: {e}")
            await ConnectionManager.remove_connection(room_id, user_id)

    @staticmethod
    def is_flooding(user_id: str) -> bool:
        """
        Calculates user's sending rate over a 5s window. 
        Protects WebSocket from overflow or malicious script loops.
        """
        now = time.time()
        if user_id not in _anti_flood_log:
            _anti_flood_log[user_id] = []
        
        history = _anti_flood_log[user_id]
        # Clear entries older than 5 seconds
        history = [ts for ts in history if now - ts < 5.0]
        _anti_flood_log[user_id] = history
        
        if len(history) >= settings.WS_ANTI_FLOOD_LIMIT:
            return True
            
        history.append(now)
        return False


async def start_websocket_handler(websocket: WebSocket, room_id_query: Optional[str] = None, room_id_path: Optional[str] = None) -> None:
    """
    Main WebSocket upgrade pipeline with support for query inputs, grace recovery periods,
    XSS sanitization routing, and ping/pong triggers.
    """
    # Accept client handshake
    await websocket.accept()
    
    room_id: str = "LOBBY"
    user_id: str = f"user_{int(time.time() * 1000)}"
    username: str = "Аноним"
    joined = False
    
    try:
        while True:
            # 1. Receive and read incoming messages
            raw_msg = await websocket.receive_text()
            
            # Message size guard
            if len(raw_msg) > settings.MAX_WS_MESSAGE_SIZE_BYTES:
                logger.warning(f"⛔ Socket message rejected. Payload exceeded limit.")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Размер сообщения превышает лимит безопасности."
                }))
                continue
                
            try:
                msg = json.loads(raw_msg)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "message": "Неверный формат JSON."}))
                continue

            msg_type = msg.get("type")
            if not msg_type:
                continue

            # Heartbeat ping/pong response
            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong", "timestamp": time.time() * 1000}))
                continue

            # Anti-flood rate-limiting
            if ConnectionManager.is_flooding(user_id):
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Слишком много сообщений! Охладите пыл на пару секунд."
                }))
                continue

            # 2. Main Join Room Handler
            if msg_type == "join":
                # Room extraction priority: Message roomId -> Query room_id -> Path room_id_path
                target_room = (
                    msg.get("roomId") or 
                    msg.get("room_id") or 
                    room_id_query or 
                    room_id_path or 
                    "LOBBY"
                )
                room_id = str(target_room).strip().upper()
                
                # Automatic generation of beautiful room codes if request is empty/undefined
                if not room_id or room_id in ("", "UNDEFINED", "NULL", "LOBBY"):
                    import secrets
                    room_id = f"ROOM_{secrets.token_hex(3).upper()}"
                    logger.info(f"🎲 Automated fallback code generated for joining player: {room_id}")

                user_id = msg.get("userId") or user_id
                username = msg.get("name", "Аноним").strip() or username
                avatar = msg.get("avatar", "🍿").strip()
                color = msg.get("color", "#3B82F6").strip()
                
                # Fetch and prepare Room State
                room = await RoomController.get_or_create_room(room_id)
                
                # Setup user profile
                member: Dict[str, Any] = {
                    "id": user_id,
                    "name": username,
                    "avatar": avatar,
                    "color": color,
                    "micEnabled": msg.get("micEnabled", False),
                    "micBlockedByHost": False,
                    "isHost": len(room["members"]) == 0 or any(m.get("isHost", False) for m in room["members"].values()) is False,
                    "joinedAt": time.time() * 1000,
                    "disconnected": False,
                    "disconnectedAt": None
                }
                
                # Save user to room structure
                room["members"][user_id] = member
                await RoomController.save_room(room_id, room)
                
                # Complete socket registrations
                await ConnectionManager.add_connection(room_id, user_id, websocket)
                joined = True
                
                # Broadcast welcome logs and state representations to user
                await websocket.send_text(json.dumps({
                    "type": "room_state",
                    "state": room,
                    "userId": user_id
                }))
                
                # Retrieve and send historical chat history
                history = await ChatManager.get_history(room_id)
                await websocket.send_text(json.dumps({
                    "type": "chat_history",
                    "history": history
                }))
                
                # Broadcast update to other members
                await ConnectionManager.broadcast_to_room(room_id, {
                    "type": "members_update",
                    "members": room["members"]
                }, exclude_user_id=user_id)
                
                logger.info(f"👤 {username} successfully registered in Sferium session: {room_id}")
                continue

            # Ensure client joined a room before passing other sync commands
            if not joined:
                await websocket.send_text(json.dumps({"type": "error", "message": "Подключитесь к комнате используя событие 'join'."}))
                continue

            # 3. Handle Playback Synchronization Change
            if msg_type == "playback_change":
                room = await RoomController.get_room(room_id)
                if not room:
                    continue
                
                # Update variables
                room["playing"] = msg.get("playing", False)
                room["currentTime"] = float(msg.get("currentTime", 0.0))
                room["playbackRate"] = float(msg.get("playbackRate", 1.0))
                room["lastUpdated"] = time.time() * 1000
                
                await RoomController.save_room(room_id, room)
                
                # Forward play/pause triggers to room participants
                await ConnectionManager.broadcast_to_room(room_id, {
                    "type": "playback_change",
                    "playing": room["playing"],
                    "currentTime": room["currentTime"],
                    "playbackRate": room["playbackRate"],
                    "issuerId": user_id
                }, exclude_user_id=user_id)
                continue

            # 4. Handle Video Resource Switch
            if msg_type == "change_video":
                room = await RoomController.get_room(room_id)
                if not room:
                    continue
                
                room["videoUrl"] = msg.get("videoUrl", "")
                room["currentTime"] = 0.0
                room["playing"] = False
                room["lastUpdated"] = time.time() * 1000
                
                await RoomController.save_room(room_id, room)
                
                await ConnectionManager.broadcast_to_room(room_id, {
                    "type": "video_changed",
                    "videoUrl": room["videoUrl"],
                    "issuerId": user_id
                })
                continue

            # 5. Handle Room Settings (Privacy and Controls)
            if msg_type == "toggle_privacy":
                room = await RoomController.get_room(room_id)
                if room:
                    room["isPublic"] = bool(msg.get("isPublic", True))
                    await RoomController.save_room(room_id, room)
                    await ConnectionManager.broadcast_to_room(room_id, {
                        "type": "privacy_updated",
                        "isPublic": room["isPublic"]
                    })
                continue

            if msg_type == "toggle_controls":
                room = await RoomController.get_room(room_id)
                if room:
                    room["anyoneCanControl"] = bool(msg.get("anyoneCanControl", True))
                    await RoomController.save_room(room_id, room)
                    await ConnectionManager.broadcast_to_room(room_id, {
                        "type": "controls_updated",
                        "anyoneCanControl": room["anyoneCanControl"]
                    })
                continue

            # 6. Handle Chat Messages
            if msg_type == "chat_message":
                text = msg.get("text", "").strip()
                if text:
                    saved_msg = await ChatManager.save_message(
                        room_id=room_id,
                        user_id=user_id,
                        username=username,
                        text=text,
                        avatar=msg.get("avatar", "🍿"),
                        color=msg.get("color", "#3B82F6")
                    )
                    if saved_msg:
                        await ConnectionManager.broadcast_to_room(room_id, {
                            "type": "chat_message",
                            "message": saved_msg
                        })
                continue

            # 7. Handle WebRTC Call Signaling Messages
            if msg_type == "webrtc_signal":
                await WebRTCSignaler.route_signal(
                    sender_id=user_id,
                    payload=msg,
                    send_to_user_callback=ConnectionManager.send_to_user
                )
                continue

            # 8. Handle Live Voice Microphone states
            if msg_type == "toggle_mic":
                room = await RoomController.get_room(room_id)
                if room and user_id in room["members"]:
                    room["members"][user_id]["micEnabled"] = bool(msg.get("enabled", False))
                    await RoomController.save_room(room_id, room)
                    await ConnectionManager.broadcast_to_room(room_id, {
                        "type": "members_update",
                        "members": room["members"]
                    })
                continue

    except WebSocketDisconnect:
        logger.info(f"🔌 Connection closed by client: User {user_id} disconnected from room {room_id}")
    except Exception as e:
        logger.error(f"❌ Internal WebSocket transaction error: {e}", exc_info=True)
    finally:
        # Grace period handling: keep profile alive for 15s to bypass short page refreshes/network drops
        if joined:
            await ConnectionManager.remove_connection(room_id, user_id)
            room = await RoomController.get_room(room_id)
            if room and user_id in room["members"]:
                # Mark as temporarily disconnected
                room["members"][user_id]["disconnected"] = True
                room["members"][user_id]["disconnectedAt"] = time.time() * 1000
                await RoomController.save_room(room_id, room)
                
                # Broadcast warning about user's signal drop
                await ConnectionManager.broadcast_to_room(room_id, {
                    "type": "members_update",
                    "members": room["members"]
                })
                
                # Fire async background task to sweep profile after grace timer ends
                asyncio.create_task(trigger_grace_period_cleanup(room_id, user_id))


async def trigger_grace_period_cleanup(room_id: str, user_id: str) -> None:
    """
    Cleans up a disconnected user after a 15-second grace period if they have not re-joined.
    If the host departs, automatically transfers host status to the next longest-joined user.
    """
    await asyncio.sleep(15.0)
    room = await RoomController.get_room(room_id)
    if room and user_id in room["members"]:
        member = room["members"][user_id]
        # Only clean up if they are still disconnected
        if member.get("disconnected", False):
            is_host = member.get("isHost", False)
            del room["members"][user_id]
            logger.info(f"🧹 Grace period expired. Cleaned up user {member.get('name')} from room {room_id}")
            
            # If room has no active members remaining, wipe room state entirely
            active_m_count = sum(1 for m in room["members"].values() if not m.get("disconnected", False))
            if len(room["members"]) == 0 or active_m_count == 0:
                await RoomController.delete_room(room_id)
                return
                
            # If the departed user was host, assign next active host
            if is_host and room["members"]:
                longest_joined_id = min(room["members"].keys(), key=lambda k: room["members"][k].get("joinedAt", time.time() * 1000))
                room["members"][longest_joined_id]["isHost"] = True
                logger.info(f"👑 Host transferred successfully to user {room['members'][longest_joined_id]['name']} in {room_id}")
                
            await RoomController.save_room(room_id, room)
            await ConnectionManager.broadcast_to_room(room_id, {
                "type": "members_update",
                "members": room["members"]
            })
