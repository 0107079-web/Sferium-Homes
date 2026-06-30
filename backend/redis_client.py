import logging
import asyncio
import json
from typing import Optional, Callable, Coroutine, Any
import redis.asyncio as aioredis
from backend.config import settings

logger = logging.getLogger("sferium.redis")

class RedisClient:
    def __init__(self):
        self.client: Optional[aioredis.Redis] = None
        self.pubsub: Optional[aioredis.client.PubSub] = None
        self.pubsub_task: Optional[asyncio.Task] = None
        self._subscriptions = {}

    async def connect(self) -> None:
        """
        Establishes connection to Redis server.
        Includes a robust fallback mode using mock states if Redis is unavailable.
        """
        try:
            self.client = aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=5.0,
                retry_on_timeout=True
            )
            # Send a Ping to confirm connection
            await self.client.ping()
            logger.info("⚡ Connection to Redis server established successfully!")
        except Exception as e:
            logger.warning(f"⚠️ Redis connection failed: {e}. Falling back to in-memory state engine.")
            self.client = None

    async def disconnect(self) -> None:
        if self.pubsub_task:
            self.pubsub_task.cancel()
            try:
                await self.pubsub_task
            except asyncio.CancelledError:
                pass
        if self.pubsub:
            await self.pubsub.close()
        if self.client:
            await self.client.close()
            logger.info("🔌 Redis connection closed safely.")

    @property
    def is_active(self) -> bool:
        return self.client is not None

    async def set_state(self, key: str, val: Any, expire_seconds: int = 86400) -> bool:
        if not self.is_active:
            return False
        try:
            serialized = json.dumps(val)
            await self.client.set(key, serialized, ex=expire_seconds)
            return True
        except Exception as e:
            logger.error(f"Redis set failed for {key}: {e}")
            return False

    async def get_state(self, key: str) -> Optional[Any]:
        if not self.is_active:
            return None
        try:
            data = await self.client.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.error(f"Redis get failed for {key}: {e}")
        return None

    async def delete_state(self, key: str) -> bool:
        if not self.is_active:
            return False
        try:
            await self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis delete failed for {key}: {e}")
            return False

    # --- Pub/Sub Scaling Interface ---
    async def publish(self, channel: str, message: dict) -> bool:
        if not self.is_active:
            return False
        try:
            await self.client.publish(channel, json.dumps(message))
            return True
        except Exception as e:
            logger.error(f"Redis Pub/Sub broadcast failed on channel {channel}: {e}")
            return False

    async def subscribe(self, channel: str, callback: Callable[[dict], Coroutine[Any, Any, None]]) -> None:
        if not self.is_active:
            self._subscriptions[channel] = callback
            return
        try:
            if not self.pubsub:
                self.pubsub = self.client.pubsub()
                self.pubsub_task = asyncio.create_task(self._listen_pubsub())
            
            await self.pubsub.subscribe(channel)
            self._subscriptions[channel] = callback
            logger.info(f"🛰️ Scaled connection: Subscribed to Redis channel {channel}")
        except Exception as e:
            logger.error(f"Redis subscribe failed on {channel}: {e}")

    async def _listen_pubsub(self) -> None:
        try:
            while True:
                if not self.pubsub:
                    await asyncio.sleep(1)
                    continue
                try:
                    message = await self.pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                    if message and message["type"] == "message":
                        channel = message["channel"]
                        data = json.loads(message["data"])
                        if channel in self._subscriptions:
                            asyncio.create_task(self._subscriptions[channel](data))
                except aioredis.ConnectionError:
                    logger.warning("Redis Pub/Sub link drop. Waiting 5s to reconnect...")
                    await asyncio.sleep(5)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error reading Redis subscription message: {e}")
                    await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            pass

redis_client = RedisClient()
