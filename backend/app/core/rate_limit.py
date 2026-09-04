# backend/app/core/rate_limit.py
from typing import Optional
from fastapi import HTTPException, Request, status
from app.core.config import settings
from app.services.redis_service import redis_service


def get_client_ip(request: Request) -> str:
    """Best-effort real client IP behind this app's own nginx reverse proxy
    (see nginx/*.conf's X-Forwarded-For/X-Real-IP headers) - falls back to
    the direct socket peer when neither header is present (local dev,
    hitting uvicorn directly). Trusting these headers assumes the app is
    only ever reached through that proxy, never directly from the open
    internet - already the assumption the rest of this deployment makes."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def format_wait(seconds: int) -> str:
    if seconds >= 60:
        minutes = max(1, round(seconds / 60))
        return f"{minutes} minute{'s' if minutes != 1 else ''}"
    return f"{seconds} second{'s' if seconds != 1 else ''}"


async def enforce_rate_limit(key: str, max_attempts: int, window_seconds: int, message: str) -> None:
    """Read-only check against a Redis counter that the caller increments
    separately via register_attempt() - this function never writes
    anything itself, so a request that's merely checking (and passes) never
    contributes to its own limit. Raises 429 with a Retry-After header (the
    standard place for this, RFC 7231) plus a plain-string human message in
    `detail` - deliberately a string, not a nested object, because the
    existing frontend already does `toast.error(error.response?.data?.detail)`
    everywhere and a string is the only shape that renders correctly there
    with zero frontend changes.

    Fails OPEN (lets the request through) if Redis is unreachable - a rate
    limiter that takes down login/registration whenever Redis hiccups would
    be a worse outage than the abuse it exists to prevent."""
    count = await redis_service.get_count(key)
    if count >= max_attempts:
        ttl = await redis_service.get_ttl(key) or window_seconds
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"{message} Please try again in {format_wait(ttl)}.",
            headers={"Retry-After": str(ttl)},
        )


async def register_attempt(key: str, window_seconds: int) -> None:
    """Counts one attempt toward a rate limit - called by the caller only
    when an attempt should actually count (e.g. login: only on a FAILED
    attempt, so mistyping a password once doesn't itself risk locking the
    account; forgot-password/resend-verification: on every call, since
    those must count regardless of outcome to prevent using them to spam a
    victim's inbox or enumerate accounts by timing)."""
    await redis_service.incr_with_expiry(key, window_seconds)


async def reset_rate_limit(key: str) -> None:
    """Clears a counter - called after a genuinely successful login so a
    user who mistyped their password a couple of times isn't left with
    stale "attempts" counted against them once they actually get in."""
    await redis_service.delete_token(key)


# ============================================
# PROGRESSIVE LOGIN COOLDOWN
# ============================================
# A separate, escalating scheme from the flat enforce_rate_limit/
# register_attempt pair above - used ONLY for login's WRONG-password
# responses (forgot-password/resend-verification stay on the simpler flat
# limiter, they don't need this).
#
# Two scopes are tracked independently, each with its own tier: "ip" (the
# caller's network - a blunt gate checked BEFORE any DB/bcrypt work, since
# it can only ever slow down requests actually coming FROM that IP) and
# "email" (the account being guessed against). The email scope is
# deliberately NEVER consulted before verifying the password - only after
# a WRONG password - so a correct login always succeeds immediately no
# matter how aggressively someone else has been guessing against that same
# email. Without that distinction, an attacker who never even knows the
# real password could still force the real owner to wait every time they
# tried to log in, turning a brute-force defense into a tool for locking
# the victim out of their own account.


def _cooldown_keys(scope: str, identity: str) -> tuple:
    base = f"login_cooldown:{scope}"
    return f"{base}:tier:{identity}", f"{base}:fails:{identity}", f"{base}:blocked:{identity}"


async def get_active_login_cooldown(scope: str, identity: str) -> Optional[int]:
    """Seconds remaining on an ALREADY-triggered cooldown for this
    scope+identity, or None if not currently cooling down. Read-only -
    checked before registering a new failure so a request arriving mid-
    cooldown re-reports the existing wait instead of extending it."""
    _, _, blocked_key = _cooldown_keys(scope, identity)
    return await redis_service.get_ttl(blocked_key)


async def register_login_failure(scope: str, identity: str, fail_threshold: int, fail_window_seconds: int) -> Optional[int]:
    """Call once per WRONG login attempt for this scope (never for a
    correct one - see this module's own header comment for why). Returns
    the number of seconds the caller should report as a cooldown - either
    because this failure just triggered/re-triggered one, or because one
    was ALREADY active - or None only when neither applies (still within
    the free fail_threshold attempts, nothing to report yet). Callers must
    treat any non-None return as "respond 429", not just a freshly-
    triggered one - a request arriving mid-cooldown still needs to be
    reported as blocked, it just shouldn't push the tier up any further.

    Grace phase (tier 0): each failure increments a counter that expires
    after fail_window_seconds of no further failures - "an appropriate
    period without failed attempts" fully forgets it. Crossing
    fail_threshold triggers tier 1.

    Recidivist phase (tier 1+, i.e. a violation happened within the last
    RATE_LIMIT_LOGIN_TIER_DECAY_SECONDS): the very next wrong attempt
    AFTER the current cooldown expires immediately escalates to the next
    tier - no further free attempts once already flagged. A wrong attempt
    arriving WHILE still actively cooling down does not escalate again
    (see the active-cooldown short-circuit below) - only mashing the
    button while blocked, not the block getting worse for it."""
    tier_key, fails_key, blocked_key = _cooldown_keys(scope, identity)

    existing_ttl = await redis_service.get_ttl(blocked_key)
    if existing_ttl:
        return existing_ttl  # already cooling down - report it, but don't escalate further

    current_tier = await redis_service.get_count(tier_key)
    if current_tier <= 0:
        fails = await redis_service.incr_with_expiry(fails_key, fail_window_seconds)
        if fails is None or fails < fail_threshold:
            return None
        new_tier = 1
    else:
        tiers = settings.login_cooldown_tiers
        new_tier = min(current_tier + 1, len(tiers))

    tiers = settings.login_cooldown_tiers
    duration = tiers[new_tier - 1]
    await redis_service.set_count(tier_key, new_tier, settings.RATE_LIMIT_LOGIN_TIER_DECAY_SECONDS)
    await redis_service.set_count(blocked_key, new_tier, duration)
    await redis_service.delete_token(fails_key)
    return duration


async def reset_login_cooldown(scope: str, identity: str) -> None:
    """Full reset after a genuinely successful login with this identity."""
    tier_key, fails_key, blocked_key = _cooldown_keys(scope, identity)
    await redis_service.delete_token(tier_key)
    await redis_service.delete_token(fails_key)
    await redis_service.delete_token(blocked_key)
