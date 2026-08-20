# backend/app/schemas/admin.py
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from app.schemas.auth import UserCreate


class StatMetric(BaseModel):
    """A real count plus an honest week-over-week trend - trend_percent is
    None when there's no prior-week data to compare against (never guessed)."""
    value: int
    trend_percent: Optional[float] = None


class EngagementTotals(BaseModel):
    """Real totals summed from the posts table's own denormalized counters
    (likes_count/comments_count/shares_count) - not a separate tracking system."""
    comments: int
    reactions: int
    shares: int


class AdminDashboardStats(BaseModel):
    total_users: StatMetric
    students: StatMetric
    professors: StatMetric
    posts: StatMetric
    reports: StatMetric
    live_streams_now: int
    engagement: EngagementTotals


class AdminUserListItem(BaseModel):
    id: str
    username: str
    email: str
    role: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    section_name: Optional[str] = None
    is_active: bool
    is_online: bool
    created_at: datetime


class AdminUserCounts(BaseModel):
    all: int
    students: int
    professors: int
    admins: int
    suspended: int


class AdminUserListResponse(BaseModel):
    items: List[AdminUserListItem]
    total: int
    page: int
    limit: int
    total_pages: int
    counts: AdminUserCounts


class UpdateUserStatusRequest(BaseModel):
    is_active: bool


class AdminCreateUserRequest(UserCreate):
    """Reuses UserCreate's existing username/email/password/confirm_password
    validation (including the password-strength rules) - admin-created
    accounts skip email verification and never need an invitation code,
    since the admin's own authority is the vouching step."""
    full_name: Optional[str] = None


class AdminCreateUserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    full_name: Optional[str] = None


class GenerateProfessorCodeRequest(BaseModel):
    validity: str = Field(..., pattern="^(1h|1d|1w)$")


class ProfessorCodeResponse(BaseModel):
    code: str
    role: str
    expires_at: datetime
    created_at: datetime
