# backend/app/api/v1/endpoints/admin.py
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_password_hash
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.models.post import Post
from app.models.friend import UserReport
from app.models.livestream import Livestream, StreamStatus
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.models.section import Section, SectionMember
from app.websocket.manager import manager
from app.services.auth_service import AuthService
from app.schemas.admin import (
    AdminDashboardStats, EngagementTotals, StatMetric,
    AdminUserListItem, AdminUserListResponse, AdminUserCounts, UpdateUserStatusRequest,
    AdminCreateUserRequest, AdminCreateUserResponse,
    GenerateProfessorCodeRequest, ProfessorCodeResponse,
)

router = APIRouter()

VALIDITY_TO_HOURS = {"1h": 1, "1d": 24, "1w": 24 * 7}


def _require_admin(current_user: User):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


async def _section_names_for_users(db: AsyncSession, user_ids: list) -> dict:
    """Real section membership lives in section_members (a student can belong
    to more than one), not the unused student_profiles.section_id column."""
    if not user_ids:
        return {}
    result = await db.execute(
        select(SectionMember.user_id, Section.name)
        .join(Section, Section.id == SectionMember.section_id)
        .where(SectionMember.user_id.in_(user_ids))
        .order_by(SectionMember.joined_at)
    )
    names_by_user: dict = {}
    for user_id, name in result.all():
        names_by_user.setdefault(str(user_id), []).append(name)
    return {uid: ", ".join(names) for uid, names in names_by_user.items()}


async def _metric(db: AsyncSession, model, extra_where=None) -> StatMetric:
    """Total count plus a real week-over-week trend (this week vs the 7 days
    before it), computed from each row's created_at. Never estimated."""
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    base = select(func.count()).select_from(model)
    if extra_where is not None:
        base = base.where(extra_where)

    total = (await db.execute(base)).scalar() or 0
    this_week = (await db.execute(base.where(model.created_at >= week_ago))).scalar() or 0
    prev_week = (await db.execute(
        base.where(model.created_at >= two_weeks_ago, model.created_at < week_ago)
    )).scalar() or 0

    if prev_week > 0:
        trend = round(((this_week - prev_week) / prev_week) * 100, 1)
    elif this_week > 0:
        trend = 100.0
    else:
        trend = None

    return StatMetric(value=total, trend_percent=trend)


@router.get("/dashboard-stats", response_model=AdminDashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Real aggregate counts for the admin dashboard - plain COUNT queries
    against existing tables. No new tables, no schema changes, admin-only."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    total_users = await _metric(db, User)
    students = await _metric(db, User, User.role == "student")
    professors = await _metric(db, User, User.role == "professor")
    posts = await _metric(db, Post)
    reports = await _metric(db, UserReport)

    live_result = await db.execute(
        select(func.count()).select_from(Livestream).where(Livestream.status == StreamStatus.LIVE)
    )
    live_streams_now = live_result.scalar() or 0

    engagement_result = await db.execute(
        select(
            func.coalesce(func.sum(Post.comments_count), 0),
            func.coalesce(func.sum(Post.likes_count), 0),
            func.coalesce(func.sum(Post.shares_count), 0),
        )
    )
    comments_sum, likes_sum, shares_sum = engagement_result.one()

    return AdminDashboardStats(
        total_users=total_users,
        students=students,
        professors=professors,
        posts=posts,
        reports=reports,
        live_streams_now=live_streams_now,
        engagement=EngagementTotals(comments=comments_sum, reactions=likes_sum, shares=shares_sum),
    )


@router.get("/user-growth")
async def get_user_growth(
    range: str = Query("week", pattern="^(today|week|month|year)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Real new-user registration counts bucketed over time, from the
    existing users.created_at column - no new tables, admin-only."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    now = datetime.now(timezone.utc)
    bucket_unit = {"today": "hour", "week": "day", "month": "day", "year": "month"}[range]
    start = {
        "today": now.replace(hour=0, minute=0, second=0, microsecond=0),
        "week": now - timedelta(days=7),
        "month": now - timedelta(days=30),
        "year": now - timedelta(days=365),
    }[range]

    bucket = func.date_trunc(bucket_unit, User.created_at)
    result = await db.execute(
        select(bucket.label("bucket"), func.count().label("count"))
        .where(User.created_at >= start)
        .group_by(bucket)
        .order_by(bucket)
    )
    return {
        "range": range,
        "bucket_unit": bucket_unit,
        "points": [{"date": row.bucket.isoformat(), "count": row.count} for row in result.all()],
    }


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, min_length=1),
    role: Optional[str] = Query(None, pattern="^(student|professor|admin)$"),
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(active|suspended)$"),
    online: Optional[str] = Query(None, pattern="^(online|offline)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Real, paginated user list for the admin User Management page - joins
    the per-role profile tables for name/avatar/section, and uses the same
    live WebSocket connection registry the Friends feature already relies on
    for online status. No new tables; admin-only."""
    _require_admin(current_user)

    query = select(User)

    if search:
        term = f"%{search}%"
        name_match_ids: set[str] = set()
        for profile_model in (StudentProfile, ProfessorProfile, AdminProfile):
            result = await db.execute(
                select(profile_model.user_id).where(
                    or_(profile_model.first_name.ilike(term), profile_model.last_name.ilike(term))
                )
            )
            name_match_ids.update(str(r) for r in result.scalars().all())

        conditions = [User.username.ilike(term), User.email.ilike(term), User.role.ilike(term)]
        if name_match_ids:
            conditions.append(User.id.in_(name_match_ids))
        query = query.where(or_(*conditions))

    if role:
        query = query.where(User.role == role)
    if status_filter == "active":
        query = query.where(User.is_active == True)  # noqa: E712
    elif status_filter == "suspended":
        query = query.where(User.is_active == False)  # noqa: E712

    query = query.order_by(User.created_at.desc())

    all_matching = (await db.execute(query)).scalars().all()

    online_ids = manager.get_online_user_ids()
    if online:
        want_online = online == "online"
        all_matching = [u for u in all_matching if (str(u.id) in online_ids) == want_online]

    total = len(all_matching)
    total_pages = max(1, (total + limit - 1) // limit)
    start_idx = (page - 1) * limit
    page_users = all_matching[start_idx:start_idx + limit]

    # Batch-fetch profile info (name/avatar) per role, plus real section
    # membership (section_members - any role can join a section, not just
    # students), for just this page.
    student_ids = [u.id for u in page_users if u.role == "student"]
    professor_ids = [u.id for u in page_users if u.role == "professor"]
    admin_ids = [u.id for u in page_users if u.role == "admin"]

    profile_by_user: dict = {}

    if student_ids:
        result = await db.execute(select(StudentProfile).where(StudentProfile.user_id.in_(student_ids)))
        for p in result.scalars().all():
            profile_by_user[str(p.user_id)] = p

    if professor_ids:
        result = await db.execute(select(ProfessorProfile).where(ProfessorProfile.user_id.in_(professor_ids)))
        for p in result.scalars().all():
            profile_by_user[str(p.user_id)] = p

    if admin_ids:
        result = await db.execute(select(AdminProfile).where(AdminProfile.user_id.in_(admin_ids)))
        for p in result.scalars().all():
            profile_by_user[str(p.user_id)] = p

    section_names_by_user = await _section_names_for_users(db, [u.id for u in page_users])

    items = []
    for u in page_users:
        profile = profile_by_user.get(str(u.id))
        full_name = None
        avatar_url = None
        if profile:
            if profile.first_name or profile.last_name:
                full_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() or None
            avatar_url = profile.avatar_url

        section_name = section_names_by_user.get(str(u.id))

        items.append(AdminUserListItem(
            id=str(u.id),
            username=u.username,
            email=u.email,
            role=u.role,
            full_name=full_name,
            avatar_url=avatar_url,
            section_name=section_name,
            is_active=u.is_active,
            is_online=str(u.id) in online_ids,
            created_at=u.created_at,
        ))

    async def _count(where=None) -> int:
        q = select(func.count()).select_from(User)
        if where is not None:
            q = q.where(where)
        return (await db.execute(q)).scalar() or 0

    counts = AdminUserCounts(
        all=await _count(),
        students=await _count(User.role == "student"),
        professors=await _count(User.role == "professor"),
        admins=await _count(User.role == "admin"),
        suspended=await _count(User.is_active == False),  # noqa: E712
    )

    return AdminUserListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        counts=counts,
    )


@router.patch("/users/{user_id}/status", response_model=AdminUserListItem)
async def update_user_status(
    user_id: str,
    data: UpdateUserStatusRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Suspend/activate a user by toggling the existing is_active flag, which
    the login flow already enforces (see auth_service.authenticate_user).
    This is the only mutation this task adds - no delete, no role change."""
    _require_admin(current_user)

    if str(current_user.id) == user_id and not data.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot suspend your own account")

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target.is_active = data.is_active
    await db.commit()
    await db.refresh(target)

    profile = None
    if target.role == "student":
        profile = (await db.execute(select(StudentProfile).where(StudentProfile.user_id == target.id))).scalar_one_or_none()
    elif target.role == "professor":
        profile = (await db.execute(select(ProfessorProfile).where(ProfessorProfile.user_id == target.id))).scalar_one_or_none()
    elif target.role == "admin":
        profile = (await db.execute(select(AdminProfile).where(AdminProfile.user_id == target.id))).scalar_one_or_none()

    full_name = None
    avatar_url = None
    if profile:
        if profile.first_name or profile.last_name:
            full_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() or None
        avatar_url = profile.avatar_url

    section_names = await _section_names_for_users(db, [target.id])
    section_name = section_names.get(str(target.id))

    online_ids = manager.get_online_user_ids()
    return AdminUserListItem(
        id=str(target.id),
        username=target.username,
        email=target.email,
        role=target.role,
        full_name=full_name,
        avatar_url=avatar_url,
        section_name=section_name,
        is_active=target.is_active,
        is_online=str(target.id) in online_ids,
        created_at=target.created_at,
    )


# ============================================
# ADMIN: CREATE USER (Student / Professor / Admin)
# ============================================

@router.post("/users", response_model=AdminCreateUserResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    data: AdminCreateUserRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin creates a user account directly - no invitation code and no
    email verification step, since the admin's own authority is what
    vouches for the account. Reuses the existing password hashing
    (get_password_hash) and per-role profile tables exactly like the public
    registration flow (AuthService.register) does."""
    _require_admin(current_user)

    if data.role not in ("student", "professor", "admin"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role must be student, professor, or admin")

    existing_email = await db.execute(select(User).where(User.email == data.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    existing_username = await db.execute(select(User).where(User.username == data.username))
    if existing_username.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    first_name = last_name = None
    if data.full_name and data.full_name.strip():
        parts = data.full_name.strip().split(maxsplit=1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else None

    user = User(
        email=data.email,
        username=data.username,
        password_hash=get_password_hash(data.password),
        role=data.role,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.flush()

    if data.role == "student":
        db.add(StudentProfile(user_id=user.id, first_name=first_name, last_name=last_name))
    elif data.role == "professor":
        db.add(ProfessorProfile(user_id=user.id, first_name=first_name, last_name=last_name))
    elif data.role == "admin":
        db.add(AdminProfile(user_id=user.id, first_name=first_name, last_name=last_name))

    await db.commit()
    await db.refresh(user)

    return AdminCreateUserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        role=user.role,
        full_name=data.full_name,
    )


# ============================================
# ADMIN: PROFESSOR REGISTRATION CODES
# ============================================

@router.post("/professor-codes", response_model=ProfessorCodeResponse, status_code=status.HTTP_201_CREATED)
async def generate_professor_code(
    data: GenerateProfessorCodeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a single-use, time-limited professor registration code.
    Reuses AuthService.create_invitation_code (the same mechanism the public
    registration flow already validates against) rather than a second code
    system."""
    _require_admin(current_user)
    service = AuthService(db)
    result = await service.create_invitation_code(
        str(current_user.id),
        role="professor",
        expires_in_hours=VALIDITY_TO_HOURS[data.validity],
        code_prefix="CCS-PROF-",
    )
    return result


@router.get("/professor-codes", response_model=List[ProfessorCodeResponse])
async def list_professor_codes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Active (unused, unexpired) professor codes only - used/expired codes
    are never shown as active, and expired rows are opportunistically
    deleted on every call."""
    _require_admin(current_user)
    service = AuthService(db)
    codes = await service.get_invitation_codes(str(current_user.id), role="professor")
    return [
        ProfessorCodeResponse(code=c.code, role=c.role, expires_at=c.expires_at, created_at=c.created_at)
        for c in codes
    ]


@router.delete("/professor-codes/{code}")
async def delete_professor_code(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually revoke/delete an unused professor code."""
    _require_admin(current_user)
    service = AuthService(db)
    return await service.delete_invitation_code(str(current_user.id), code)
