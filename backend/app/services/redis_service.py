# backend/app/services/redis_service.py
import redis.asyncio as redis
from app.core.config import settings
import json
import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)

class RedisService:
    def __init__(self):
        self.redis_url = settings.REDIS_URL
        self.client = None
        self._connect()

    def _connect(self):
        """Connect to Redis"""
        try:
            self.client = redis.from_url(
                self.redis_url,
                decode_responses=True,
                max_connections=10
            )
            logger.info("✅ Redis connected successfully")
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            self.client = None

    async def set_token(self, key: str, value: Any, expire_seconds: int = 3600):
        """Store token in Redis with expiration"""
        if not self.client:
            return False
        try:
            await self.client.setex(
                key,
                expire_seconds,
                json.dumps(value)
            )
            return True
        except Exception as e:
            logger.error(f"❌ Redis set error: {e}")
            return False

    async def get_token(self, key: str) -> Optional[Any]:
        """Get token from Redis"""
        if not self.client:
            return None
        try:
            data = await self.client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"❌ Redis get error: {e}")
            return None

    async def delete_token(self, key: str):
        """Delete token from Redis"""
        if not self.client:
            return False
        try:
            await self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"❌ Redis delete error: {e}")
            return False

    async def close(self):
        """Close Redis connection"""
        if self.client:
            await self.client.close()
            logger.info("✅ Redis connection closed")

# Create singleton instance
redis_service = RedisService()