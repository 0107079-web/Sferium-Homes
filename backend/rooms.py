import logging
import time
from typing import Dict, Any, Optional, List
from backend.models import RoomStateSchema, RoomMemberSchema
from backend.redis_client import redis_client

logger = logging.getLogger("sferium.rooms")

# Direct high-speed in-memory fallback for local performance
_local_rooms: Dict[str, Dict[str, Any]] = {}

class RoomController:
    @staticmethod
    async def get_room(room_id: str) -> Optional[Dict[str, Any]]:
        room_id = room_id.upper().strip()
        
        # 1. Check Redis first
        if redis_client.is_active:
            state = await redis_client.get_state(f"room:{room_id}")
            if state:
                return state
        
        # 2. Fallback to local memory
        return _local_rooms.get(room_id)

    @staticmethod
    async def save_room(room_id: str, room_data: Dict[str, Any]) -> None:
        room_id = room_id.upper().strip()
        
        # 1. Update local cache
        _local_rooms[room_id] = room_data
        
        # 2. Push to Redis if active
        if redis_client.is_active:
            await redis_client.set_state(f"room:{room_id}", room_data, expire_seconds=86400) # Expire in 24 hours

    @staticmethod
    async def create_room(room_id: str, creator_id: Optional[str] = None) -> Dict[str, Any]:
        room_id = room_id.upper().strip()
        
        default_state = {
            "roomId": room_id,
            "videoUrl": "https://www.youtube.com/watch?v=ScMzIvxBSi4",  # Sferium introductory default
            "playing": False,
            "currentTime": 0.0,
            "playbackRate": 1.0,
            "lastUpdated": time.time() * 1000,
            "anyoneCanControl": True,
            "isPublic": True,
            "members": {}
        }
        
        await RoomController.save_room(room_id, default_state)
        logger.info(f"🆕 Room {room_id} has been initialized successfully.")
        return default_state

    @staticmethod
    async def get_or_create_room(room_id: str) -> Dict[str, Any]:
        room = await RoomController.get_room(room_id)
        if not room:
            room = await RoomController.create_room(room_id)
        return room

    @staticmethod
    async def get_public_rooms() -> List[Dict[str, Any]]:
        """
        Gathers list of all active public rooms with active participant counts.
        """
        public_list = []
        
        # Gather all from local cache
        for rid, room in _local_rooms.items():
            if room.get("isPublic", True):
                # Count non-disconnected active members
                active_count = sum(1 for m in room.get("members", {}).values() if not m.get("disconnected", False))
                
                # Fetch first video URL title representation
                v_url = room.get("videoUrl", "")
                title_msg = v_url if len(v_url) < 35 else f"{v_url[:32]}..."
                
                public_list.append({
                    "roomId": rid,
                    "name": f"🔥 Открытая Комната #{rid}",
                    "membersCount": active_count,
                    "currentVideoTitle": title_msg or "Фильм",
                    "videoUrl": v_url,
                    "isMock": False,
                    "members": [
                        {
                            "id": m["id"],
                            "name": m["name"],
                            "avatar": m.get("avatar", "🍿"),
                            "color": m.get("color", "#3B82F6")
                        }
                        for m in room.get("members", {}).values() if not m.get("disconnected", False)
                    ]
                })
        
        return public_list

    @staticmethod
    async def delete_room(room_id: str) -> None:
        room_id = room_id.upper().strip()
        if room_id in _local_rooms:
            del _local_rooms[room_id]
        if redis_client.is_active:
            await redis_client.delete_state(f"room:{room_id}")
        logger.info(f"🗑️ Stale room {room_id} deleted permanently.")
