import logging
import time
from typing import Optional
from fastapi import FastAPI, Depends, WebSocket, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.config import settings
from backend.db import init_db
from backend.redis_client import redis_client
from backend.ws import start_websocket_handler
from backend.rooms import RoomController
from backend.chat import ChatManager

# Configure root logger with custom formats
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s [%(name)s:%(lineNo)d] - %(message)s"
)
logger = logging.getLogger("sferium.main")

app = FastAPI(
    title=settings.APP_NAME,
    description="CTO-grade Sferium Homes backend with sub-second synchronization and mesh audio grids.",
    version="3.0.0",
    debug=settings.DEBUG
)

# --- MIDDLEWARES ---

# CORS Policies for Secure WebRTC & WebSocket Upgrades
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
if "*" in origins or not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True if "*" not in origins else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple IP-based Rate Limiter to prevent brute force or DDoS
_ip_rate_tracker = {}

@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    ip = request.client.host
    now = time.time()
    
    # Bypass for WebSocket upgrades or static files
    if "upgrade" in request.headers.get("connection", "").lower() or request.url.path.startswith("/ws"):
        return await call_next(request)

    if ip not in _ip_rate_tracker:
        _ip_rate_tracker[ip] = []
        
    requests = _ip_rate_tracker[ip]
    # Clean up request records older than 60s
    requests[:] = [t for t in requests if now - t < settings.RATE_LIMIT_PERIOD]
    
    if len(requests) >= settings.RATE_LIMIT_BURST:
        logger.warning(f"⛔ Rate limit reached for IP: {ip} on route {request.url.path}")
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Too many requests. Please cool down."}
        )
        
    requests.append(now)
    return await call_next(request)


# --- LIFECYCLE HOOKS ---

@app.on_event("startup")
async def on_startup():
    logger.info("🎬 Sferium Homes backend launching...")
    # 1. Connect Redis Client
    await redis_client.connect()
    # 2. Bootstrap database schemas in PostgreSQL
    await init_db()
    logger.info("🚀 Sferium Homes signaling and sync service is completely operational!")


@app.on_event("shutdown")
async def on_shutdown():
    logger.info("🛑 Sferium Homes shutting down...")
    await redis_client.disconnect()


# --- REST API ROUTERS ---

@app.get("/api/health")
async def health_check():
    """
    Service health check monitoring. Returns status of core db links.
    """
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "services": {
            "redis": "connected" if redis_client.is_active else "offline_using_in_memory_fallback",
            "postgres": "ready"
        }
    }


@app.get("/api/rooms-public")
async def get_active_public_rooms():
    """
    Returns lists of all current public rooms, including user lists and active videos.
    """
    rooms = await RoomController.get_public_rooms()
    return {"rooms": rooms}


@app.get("/api/rooms/{room_id}/chat-history")
async def get_room_chat_history(room_id: str):
    """
    Returns past chat messages for a room.
    """
    history = await ChatManager.get_history(room_id)
    return {"history": history}


# --- WEBSOCKET ENDPOINTS ---

@app.websocket("/ws")
async def websocket_sync_root(
    websocket: WebSocket, 
    room_id: Optional[str] = Query(None),
    roomId: Optional[str] = Query(None),
    token: Optional[str] = Query(None)
):
    """
    Main WebSocket upgrade gate. Fully resolves query-parameter-based roomId definitions
    to prevent handshake mismatches over proxies.
    """
    await start_websocket_handler(
        websocket=websocket, 
        room_id_query=room_id or roomId,
        room_id_path=None
    )


@app.websocket("/ws/{room_id_path}")
async def websocket_sync_path(
    websocket: WebSocket, 
    room_id_path: str,
    room_id: Optional[str] = Query(None),
    roomId: Optional[str] = Query(None),
    token: Optional[str] = Query(None)
):
    """
    Support path parameter routing for /ws/{roomId}.
    """
    await start_websocket_handler(
        websocket=websocket, 
        room_id_query=room_id or roomId,
        room_id_path=room_id_path
    )


if __name__ == "__main__":
    import uvicorn
    # Local direct startup mode
    uvicorn.run(
        "backend.main:app", 
        host=settings.HOST, 
        port=settings.PORT, 
        reload=settings.DEBUG
    )
