import logging
import time
import re
from typing import List, Dict, Any
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models import DbChatMessage, ChatMessageSchema
from backend.db import async_session_factory

logger = logging.getLogger("sferium.chat")

# Local memory-based fallback cache if DB is not provisioned or has configuration errors
_fallback_chat_history: Dict[str, List[Dict[str, Any]]] = {}

def sanitize_html(text: str) -> str:
    """
    Strips raw HTML tags, javascript injections, and template literal tags.
    This offers robust protection against XSS attacks in joint chat modules.
    """
    # Remove HTML tags completely
    clean = re.sub(r'<[^>]*?>', '', text)
    # Filter suspicious script payloads or href injections
    clean = re.sub(r'(javascript:|onload=|onerror=|onclick=)', '', clean, flags=re.IGNORECASE)
    return clean.strip()

class ChatManager:
    @staticmethod
    async def save_message(
        room_id: str, 
        user_id: str, 
        username: str, 
        text: str, 
        avatar: str = "🍿", 
        color: str = "#3B82F6"
    ) -> Dict[str, Any]:
        """
        Sanitizes and stores a chat message. Attempts database save, falling back to local memory.
        """
        room_id = room_id.upper().strip()
        sanitized_text = sanitize_html(text)
        
        # Guard against spam/empty content
        if not sanitized_text:
            return {}
            
        # Message size limit
        if len(sanitized_text) > 1000:
            sanitized_text = sanitized_text[:997] + "..."

        timestamp_ms = time.time() * 1000
        message_payload = {
            "roomId": room_id,
            "userId": user_id,
            "username": username,
            "avatar": avatar,
            "color": color,
            "text": sanitized_text,
            "timestamp": timestamp_ms
        }

        # 1. Store in PostgreSQL if session is ready
        try:
            async with async_session_factory() as session:
                db_msg = DbChatMessage(
                    room_id=room_id,
                    user_id=user_id,
                    username=username,
                    user_avatar=avatar,
                    user_color=color,
                    message_text=sanitized_text
                )
                session.add(db_msg)
                await session.commit()
                logger.debug(f"💾 Message saved to PostgreSQL: {room_id}")
        except Exception as e:
            # Fallback to local memory storage gracefully
            logger.debug(f"⚠️ PG save failed, routing message to fallback buffer: {e}")
            if room_id not in _fallback_chat_history:
                _fallback_chat_history[room_id] = []
            
            # Keep history limited to 150 entries to avoid memory bloating
            history = _fallback_chat_history[room_id]
            history.append(message_payload)
            if len(history) > 150:
                history.pop(0)

        return message_payload

    @staticmethod
    async def get_history(room_id: str) -> List[Dict[str, Any]]:
        """
        Retrieves history for a given room. Merges fallback memory and database targets.
        """
        room_id = room_id.upper().strip()
        history_list = []

        try:
            async with async_session_factory() as session:
                query = select(DbChatMessage).where(DbChatMessage.room_id == room_id).order_by(DbChatMessage.id.asc()).limit(100)
                result = await session.execute(query)
                messages = result.scalars().all()
                for msg in messages:
                    history_list.append({
                        "roomId": msg.room_id,
                        "userId": msg.user_id,
                        "username": msg.username,
                        "avatar": msg.user_avatar,
                        "color": msg.user_color,
                        "text": msg.message_text,
                        "timestamp": msg.timestamp.timestamp() * 1000
                    })
                if history_list:
                    return history_list
        except Exception as e:
            logger.debug(f"⚠️ PostgreSQL select failed. Defaulting to local memory index. Reason: {e}")

        # Fallback list if database query had errors or was empty
        return _fallback_chat_history.get(room_id, [])
u""
