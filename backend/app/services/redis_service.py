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

    async def incr_with_expiry(self, key: str, window_seconds: int) -> Optional[int]:
        """Atomically increment a counter, setting its TTL only on the very
        first increment (so the window is fixed from the first attempt, not
        pushed back by every subsequent one) - the building block for
        Redis-backed rate limiting (see app/core/rate_limit.py). Uses a
        pipeline so the INCR and the conditional EXPIRE happen as one round
        trip; returns None (fail open, never blocks a real request) if Redis
        is unavailable, matching every other method on this class."""
        if not self.client:
            return None
        try:
            async with self.client.pipeline(transaction=True) as pipe:
                pipe.incr(key)
                count = (await pipe.execute())[0]
            if count == 1:
                await self.client.expire(key, window_seconds)
            return count
        except Exception as e:
            logger.error(f"❌ Redis incr error: {e}")
            return None

    async def get_count(self, key: str) -> int:
        """Current value of a counter written by incr_with_expiry, as a
        plain int (not JSON-decoded like get_token) - 0 if the key doesn't
        exist or Redis is unavailable, which is exactly the right default
        for a rate-limit check (never blocks when the counter can't be read)."""
        if not self.client:
            return 0
        try:
            value = await self.client.get(key)
            return int(value) if value is not None else 0
        except Exception as e:
            logger.error(f"❌ Redis get_count error: {e}")
            return 0

    async def set_count(self, key: str, value: int, ttl_seconds: int) -> bool:
        """Set a plain-integer counter to an exact value with a fixed TTL -
        unlike incr_with_expiry (which only ever goes up by 1 and sets TTL
        once), this is for the progressive login-cooldown tier state, which
        needs to jump straight to a specific tier number and have its TTL
        refreshed every time a new tier is set."""
        if not self.client:
            return False
        try:
            await self.client.set(key, value, ex=ttl_seconds)
            return True
        except Exception as e:
            logger.error(f"❌ Redis set_count error: {e}")
            return False

    async def get_ttl(self, key: str) -> Optional[int]:
        """Seconds remaining before `key` expires, or None if it doesn't
        exist / Redis is unavailable."""
        if not self.client:
            return None
        try:
            ttl = await self.client.ttl(key)
            return ttl if ttl and ttl > 0 else None
        except Exception as e:
            logger.error(f"❌ Redis ttl error: {e}")
            return None

# Create singleton instance
redis_service = RedisService()