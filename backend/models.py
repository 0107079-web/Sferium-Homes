from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, ForeignKey
from backend.db import Base

# --- POSTGRESQL PERSISTENCE MODELS (SQLAlchemy 2.0) ---

class DbRoom(Base):
    __tablename__ = "rooms"

    room_id = Column(String(50), primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_public = Column(Boolean, default=True)
    video_url = Column(Text, nullable=True)
    creator_id = Column(String(100), nullable=True)


class DbChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(String(50), index=True, nullable=False)
    user_id = Column(String(100), nullable=False)
    username = Column(String(100), nullable=False)
    user_avatar = Column(String(50), default="🍿")
    user_color = Column(String(20), default="#3B82F6")
    message_text = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)


# --- PYDANTIC VALIDATION MODELS (API and WS Schemas) ---

class RoomMemberSchema(BaseModel):
    id: str
    name: str
    avatar: str = "🍿"
    color: str = "#3B82F6"
    micEnabled: bool = False
    micBlockedByHost: bool = False
    isHost: bool = False
    joinedAt: float
    disconnected: bool = False
    disconnectedAt: Optional[float] = None


class RoomStateSchema(BaseModel):
    roomId: str
    videoUrl: str = ""
    playing: bool = False
    currentTime: float = 0.0
    playbackRate: float = 1.0
    lastUpdated: float
    anyoneCanControl: bool = True
    isPublic: bool = True
    members: Dict[str, RoomMemberSchema] = {}


class ChatMessageSchema(BaseModel):
    roomId: str
    userId: str
    username: str
    avatar: str = "🍿"
    color: str = "#3B82F6"
    text: str
    timestamp: float


# --- WEBRTC SIGNALING PACKETS ---

class WebRTCSignalPacket(BaseModel):
    type: str = Field(..., description="Must be one of: 'offer', 'answer', 'candidate'")
    roomId: str
    senderId: str
    targetId: str
    sdp: Optional[str] = None
    candidate: Optional[Any] = None
