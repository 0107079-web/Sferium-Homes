import logging
from typing import Dict, Any, Optional
from backend.models import WebRTCSignalPacket

logger = logging.getLogger("sferium.webrtc")

class WebRTCSignaler:
    @staticmethod
    async def route_signal(
        sender_id: str,
        payload: Dict[str, Any],
        send_to_user_callback: Any
    ) -> None:
        """
        Processes signaling packets (offer, answer, ice candidate) and forwards them 
        to the requested target peer.
        """
        try:
            # Validate input schema
            packet = WebRTCSignalPacket(**payload)
            
            # Form target message payload
            forward_payload = {
                "type": "webrtc_signal",
                "signalType": packet.type,
                "roomId": packet.roomId,
                "senderId": sender_id,
                "targetId": packet.targetId,
                "sdp": packet.sdp,
                "candidate": packet.candidate
            }
            
            logger.debug(f"🛰️ Routing WebRTC {packet.type} signal from {sender_id} to {packet.targetId} in room {packet.roomId}")
            await send_to_user_callback(packet.roomId, packet.targetId, forward_payload)
            
        except Exception as e:
            logger.error(f"❌ WebRTC signaling routing failed: {e}")
