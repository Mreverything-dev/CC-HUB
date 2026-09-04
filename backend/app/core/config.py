# backend/app/core/config.py
from typing import List, Optional

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    FIRST_SUPERUSER_EMAIL: str
    FIRST_SUPERUSER_PASSWORD: str
    # Database
    DATABASE_URL: str = "postgresql://root:ccshub26@localhost:5432/ccs_hub"
    DATABASE_ECHO: bool = False
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40
    DATABASE_POOL_TIMEOUT: int = 30

    # Email Settings (for fastapi-mail) - sourced from .env only; no real
    # credentials are hardcoded here so nothing sensitive lives in source.
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "noreply@ccshub.edu.com"
    MAIL_FROM_NAME: str = "CCS HUB"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Verification Settings
    VERIFICATION_TOKEN_EXPIRE_MINUTES: int = 60
    FRONTEND_URL: str = "http://localhost:3000"
    
    # Security
    SECRET_KEY: str = "your-super-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Rate limiting (Redis-backed, see app/core/rate_limit.py). Per-email
    # limits are intentionally tighter than per-IP ones - a campus network
    # (NAT/shared Wi-Fi) can put many legitimate students behind one IP, so
    # an aggressive per-IP limit would risk locking out an entire building
    # over a few unrelated failed logins, while a single account being
    # brute-forced still needs to be stopped quickly regardless of IP.
    #
    # Login uses a PROGRESSIVE cooldown, not a flat cap: _MAX/_WINDOW below
    # are the free "grace" attempts before the FIRST cooldown tier triggers
    # (an account that hasn't misbehaved recently gets this many honest
    # mistakes with no penalty at all, decaying back to zero after
    # _WINDOW_SECONDS of no further failures). Once tier 1 has triggered,
    # ANY further wrong attempt immediately escalates to the next tier in
    # LOGIN_COOLDOWN_TIERS_SECONDS - see AuthService.login and
    # app/core/rate_limit.py's register_login_failure for the full
    # algorithm, including why a CORRECT password always bypasses this
    # entirely (so it can never be weaponized into locking out the real
    # account owner).
    RATE_LIMIT_LOGIN_EMAIL_MAX: int = 5
    RATE_LIMIT_LOGIN_EMAIL_WINDOW_SECONDS: int = 900       # 15 minutes
    RATE_LIMIT_LOGIN_IP_MAX: int = 30
    RATE_LIMIT_LOGIN_IP_WINDOW_SECONDS: int = 900          # 15 minutes
    # How long a tier "remembers" a recent violation - a fresh failure
    # within this long of the last one keeps escalating; going quiet for
    # longer than this fully resets back to the grace phase above.
    RATE_LIMIT_LOGIN_TIER_DECAY_SECONDS: int = 1800        # 30 minutes
    # The escalation ladder itself, in seconds - comma-separated so it's a
    # single easy env-var override; the last value is the effective
    # maximum cooldown, however many violations keep happening.
    RATE_LIMIT_LOGIN_COOLDOWN_TIERS_SECONDS: str = "30,60,120,300,600,900"
    RATE_LIMIT_PASSWORD_RESET_EMAIL_MAX: int = 3
    RATE_LIMIT_PASSWORD_RESET_EMAIL_WINDOW_SECONDS: int = 900   # 15 minutes
    RATE_LIMIT_PASSWORD_RESET_IP_MAX: int = 10
    RATE_LIMIT_PASSWORD_RESET_IP_WINDOW_SECONDS: int = 900      # 15 minutes
    RATE_LIMIT_RESEND_VERIFICATION_EMAIL_MAX: int = 3
    RATE_LIMIT_RESEND_VERIFICATION_EMAIL_WINDOW_SECONDS: int = 900  # 15 minutes
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    # Additionally allow any origin on a private LAN (192.168.x.x, 10.x.x.x,
    # 172.16-31.x.x) hitting the Vite dev ports - lets a phone on the same
    # Wi-Fi reach this API via the computer's local IP without having to
    # hardcode that IP (which changes across networks/DHCP leases) into
    # CORS_ORIGINS. Private ranges are never publicly routable, so this
    # can't be reached from the open internet.
    CORS_ORIGIN_REGEX: Optional[str] = (
        r"^http://(localhost|127\.0\.0\.1|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):(3000|5173)$"
    )
    
    MINIO_ENDPOINT: str = "192.168.0.109:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "ccs-hub"
    MINIO_SECURE: bool = False
    MINIO_PUBLIC_URL: Optional[str] = None  # For CDN/nginx proxy
    MINIO_PUBLIC_URL: Optional[str] = "http://192.168.0.109:9000"
    # App
    DEBUG: str = "True"
    LOG_LEVEL: str = "INFO"
    APP_ENV: str = "development"
    APP_NAME: str = "CCS HUB API"
    APP_VERSION: str = "1.0.0"
    
    # Use model_config (this is the modern way)
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",  # This allows extra fields from .env
        "case_sensitive": True,
    }

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def login_cooldown_tiers(self) -> List[int]:
        return [int(v.strip()) for v in self.RATE_LIMIT_LOGIN_COOLDOWN_TIERS_SECONDS.split(",") if v.strip()]

settings = Settings()
