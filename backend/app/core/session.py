# backend/app/core/session.py
from datetime import datetime, timezone
from typing import Optional
from app.services.redis_service import redis_service


def session_valid_after_key(user_id: str) -> str:
    return f"session_valid_after:{user_id}"


async def invalidate_sessions(user_id: str, ttl_seconds: int) -> None:
    """Marks every access/refresh token issued for this user before right
    now as invalid - call after any event that should kill existing
    sessions (password reset, password change confirmation). Checked by
    both get_current_user (access tokens) and AuthService.refresh_token
    (refresh tokens) via is_token_still_valid, so a token stolen before the
    change doesn't keep working indefinitely afterward. `ttl_seconds`
    should cover the longest-lived token type this app issues (refresh
    tokens) so the marker itself never expires before every old token
    naturally would have anyway."""
    await redis_service.set_token(
        session_valid_after_key(user_id),
        {"ts": datetime.now(timezone.utc).isoformat()},
        ttl_seconds,
    )


async def is_token_still_valid(user_id: str, issued_at: Optional[int]) -> bool:
    """False if this user's sessions were invalidated (see
    invalidate_sessions) at or after the moment this token was issued
    (`issued_at`, the JWT's own `iat` claim, seconds since epoch)."""
    invalidated = await redis_service.get_token(session_valid_after_key(user_id))
    if not invalidated:
        return True
    if issued_at is None:
        return False
    valid_after = datetime.fromisoformat(invalidated["ts"])
    return datetime.fromtimestamp(issued_at, tz=timezone.utc) >= valid_after
