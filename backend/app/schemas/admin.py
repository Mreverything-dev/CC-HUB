# backend/app/schemas/admin.py
import re
from pydantic import BaseModel, EmailStr, Field, validator
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
    online_users_now: int
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


class UpdateUserRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(student|professor|admin)$")


class AdminUpdateUserRequest(BaseModel):
    """General profile fields an admin can edit - all optional (only the
    fields actually provided are changed). username/email go on the User
    row itself; first_name/last_name go on whichever per-role profile table
    already matches the user (StudentProfile/ProfessorProfile/AdminProfile -
    the same three-way dispatch update_user_role already uses)."""
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)


class AdminSetPasswordRequest(BaseModel):
    """Admin sets a new password for another user directly - no old
    password required (the admin's own authority is the vouching step,
    same reasoning as AdminCreateUserRequest skipping email verification).
    Reuses UserCreate's exact password-strength rule for consistency with
    how every account's password is otherwise provisioned."""
    new_password: str = Field(..., min_length=6)
    confirm_password: str

    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        return v

    @validator('confirm_password')
    def passwords_match(cls, v, values, **kwargs):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v


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


# ============================================
# ADMIN: POSTS
# ============================================

class AdminPostListItem(BaseModel):
    id: str
    content: Optional[str] = None
    type: str
    visibility: str
    media_urls: List[str] = []
    author_id: str
    author_username: str
    author_full_name: Optional[str] = None
    author_avatar_url: Optional[str] = None
    author_role: str
    likes_count: int
    comments_count: int
    shares_count: int
    created_at: datetime


class AdminPostListResponse(BaseModel):
    items: List[AdminPostListItem]
    total: int
    page: int
    limit: int
    total_pages: int


class BulkDeletePostsRequest(BaseModel):
    post_ids: List[str] = Field(..., min_length=1, max_length=200)


class BulkDeletePostsResponse(BaseModel):
    deleted_count: int
    deleted_ids: List[str]
    not_found_ids: List[str]


# ============================================
# ADMIN: ANNOUNCEMENTS
# ============================================

class AdminAnnouncementListItem(BaseModel):
    id: str
    title: str
    content: str
    type: str
    priority: str
    created_by_role: str
    author_id: str
    author_username: str
    author_full_name: Optional[str] = None
    author_avatar_url: Optional[str] = None
    is_published: bool
    audience: str
    target_section_names: List[str] = []
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime] = None


class AdminAnnouncementListResponse(BaseModel):
    items: List[AdminAnnouncementListItem]
    total: int
    page: int
    limit: int
    total_pages: int


# ============================================
# ADMIN: LIVESTREAMS / MEETHUB
# ============================================

class AdminLivestreamListItem(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    visibility: str
    host_id: str
    host_username: str
    host_full_name: Optional[str] = None
    host_avatar_url: Optional[str] = None
    viewer_count: int
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    is_meethub: bool
    # Meethub-only fields (None for a plain livestream)
    section_name: Optional[str] = None
    subject: Optional[str] = None


class AdminLivestreamListResponse(BaseModel):
    items: List[AdminLivestreamListItem]
    total: int


class AdminStreamViewerItem(BaseModel):
    user_id: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    joined_at: datetime
    is_active: bool


# ============================================
# ADMIN: SECTIONS
# ============================================

class AdminSectionListItem(BaseModel):
    id: str
    name: str
    course: Optional[str] = None
    year_level: Optional[int] = None
    academic_year: Optional[str] = None
    advisor_id: Optional[str] = None
    advisor_name: Optional[str] = None
    member_count: int
    professor_names: List[str] = []
    subjects: List[str] = []
    created_at: datetime


class AdminSectionListResponse(BaseModel):
    items: List[AdminSectionListItem]
    total: int


# ============================================
# ADMIN: REPORTS
# ============================================

class AdminReportedUser(BaseModel):
    """Deliberately no email/contact fields here - this is the REPORTED
    user, shown to the admin so they know who the moderation action would
    target. The REPORTER is never represented anywhere in this schema."""
    id: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str


class AdminReportedPost(BaseModel):
    """`exists=False` means the post was already deleted (by its author or
    a prior moderation action). When it was removed via this report's own
    "Remove Post" moderation action, `removed_by_moderation` is True and
    content/media_urls still carry the snapshot captured at removal time -
    otherwise there's nothing left to preview. `id` is None once the post
    row itself is gone (its id was never worth keeping past that point)."""
    id: Optional[str] = None
    content: Optional[str] = None
    media_urls: List[str] = []
    exists: bool
    created_at: Optional[datetime] = None
    removed_by_moderation: bool = False


class AdminReportRestriction(BaseModel):
    reason: str
    restricted_at: datetime
    restricted_until: datetime


class AdminReportListItem(BaseModel):
    id: str
    category: str
    category_label: str
    priority: str
    details: Optional[str] = None
    status: str
    reported_user: AdminReportedUser
    reported_post: Optional[AdminReportedPost] = None
    created_at: datetime
    moderated_at: Optional[datetime] = None
    warning_issued: bool = False
    post_removed: bool = False
    restriction: Optional[AdminReportRestriction] = None
    admin_message: Optional[str] = None


class AdminReportListResponse(BaseModel):
    items: List[AdminReportListItem]
    total: int
    page: int
    limit: int
    total_pages: int


class RestrictUserRequest(BaseModel):
    duration: str = Field(..., pattern="^(1d|1w|1m)$")


class ModerationActionResponse(BaseModel):
    id: str
    status: str
    warning_issued: bool
    post_removed: bool
    message: str
