# backend/app/api/v1/endpoints/admin.py
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_, delete as sa_delete, update as sa_update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_password_hash
from app.dependencies.auth import get_current_user, get_current_admin_user
from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.models.like import Like
from app.models.notification import Notification
from app.models.friend import UserReport
from app.models.invitation_code import InvitationCode
from app.models.conversation import Message
from app.models.livestream import Livestream, StreamStatus, StreamViewer
from app.models.meethub import MeethubSession
from app.models.announcement import Announcement, AnnouncementTarget
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.models.section import Section, SectionMember
from app.models.teaching_assignment import TeachingAssignment
from app.models.moderation import UserRestriction
from app.websocket.manager import manager
from app.services.auth_service import AuthService
from app.services.livestream_service import LivestreamService
from app.services.moderation_service import ModerationService, CATEGORY_LABELS, HIGH_PRIORITY_CATEGORIES
from app.services.post_service import PostService
from app.schemas.report import ConfirmViolationRequest
from app.schemas.admin import (
    AdminDashboardStats, EngagementTotals, StatMetric,
    AdminUserListItem, AdminUserListResponse, AdminUserCounts, UpdateUserStatusRequest,
    UpdateUserRoleRequest, AdminUpdateUserRequest, AdminSetPasswordRequest,
    AdminCreateUserRequest, AdminCreateUserResponse,
    GenerateProfessorCodeRequest, ProfessorCodeResponse,
    AdminPostListItem, AdminPostListResponse,
    BulkDeletePostsRequest, BulkDeletePostsResponse,
    AdminAnnouncementListItem, AdminAnnouncementListResponse,
    AdminLivestreamListItem, AdminLivestreamListResponse, AdminStreamViewerItem,
    AdminSectionListItem, AdminSectionListResponse,
    AdminReportedUser, AdminReportedPost, AdminReportRestriction,
    AdminReportListItem, AdminReportListResponse,
    RestrictUserRequest, ModerationActionResponse,
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


async def _profile_for(db: AsyncSession, target: User):
    """The one role-specific profile row for a user, if any - same
    student/professor/admin dispatch used throughout this file."""
    model = {"student": StudentProfile, "professor": ProfessorProfile, "admin": AdminProfile}.get(target.role)
    if not model:
        return None
    result = await db.execute(select(model).where(model.user_id == target.id))
    return result.scalar_one_or_none()


async def _build_user_item(db: AsyncSession, target: User) -> AdminUserListItem:
    """Single-user version of list_users' row-building logic (profile join +
    section membership + online status) - reused by the list, status-update,
    role-update, and single-user-detail endpoints so they can never drift
    out of sync with each other."""
    profile = await _profile_for(db, target)
    full_name = None
    avatar_url = None
    if profile:
        if profile.first_name or profile.last_name:
            full_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() or None
        avatar_url = profile.avatar_url

    section_names = await _section_names_for_users(db, [target.id])
    online_ids = manager.get_online_user_ids()

    return AdminUserListItem(
        id=str(target.id),
        username=target.username,
        email=target.email,
        role=target.role,
        full_name=full_name,
        avatar_url=avatar_url,
        section_name=section_names.get(str(target.id)),
        is_active=target.is_active,
        is_online=str(target.id) in online_ids,
        created_at=target.created_at,
    )


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

    # Every user (student/professor/admin alike) with at least one active
    # WebSocket connection right now - same manager.get_online_user_ids()
    # already used for each user row's is_online flag, just counted here.
    online_users_now = len(manager.get_online_user_ids())

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
        online_users_now=online_users_now,
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
    section_id: Optional[str] = Query(None, alias="section"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Real, paginated user list for the admin User Management page - joins
    the per-role profile tables for name/avatar/section, and uses the same
    live WebSocket connection registry the Friends feature already relies on
    for online status. No new tables; admin-only."""
    _require_admin(current_user)

    query = select(User)

    if section_id:
        query = query.where(
            User.id.in_(select(SectionMember.user_id).where(SectionMember.section_id == section_id))
        )

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
    the login flow already enforces (see auth_service.authenticate_user)."""
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

    return await _build_user_item(db, target)


@router.get("/users/{user_id}", response_model=AdminUserListItem)
async def get_user_detail(
    user_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Single-user detail for the admin User Management page's "View
    Details" action - same shape as a list row (this table has no extra
    admin-only columns beyond what the list already carries), just fetched
    fresh for one user instead of a page of them."""
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return await _build_user_item(db, target)


@router.patch("/users/{user_id}/role", response_model=AdminUserListItem)
async def update_user_role(
    user_id: str,
    data: UpdateUserRoleRequest,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Change a user's role. Creates an empty profile row for the new role
    if one doesn't exist yet (carrying over first/last name from whichever
    profile they had, best-effort) - the existing profile row for their old
    role is left in place rather than deleted, so no data is destroyed by a
    role change that gets corrected later."""
    if str(current_user.id) == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot change your own role")

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target.role == data.role:
        return await _build_user_item(db, target)

    old_profile = await _profile_for(db, target)
    first_name = old_profile.first_name if old_profile else None
    last_name = old_profile.last_name if old_profile else None

    target.role = data.role
    await db.flush()

    new_profile_model = {"student": StudentProfile, "professor": ProfessorProfile, "admin": AdminProfile}[data.role]
    existing_new_profile = (
        await db.execute(select(new_profile_model).where(new_profile_model.user_id == target.id))
    ).scalar_one_or_none()
    if not existing_new_profile:
        db.add(new_profile_model(user_id=target.id, first_name=first_name, last_name=last_name))

    await db.commit()
    await db.refresh(target)
    return await _build_user_item(db, target)


@router.put("/users/{user_id}", response_model=AdminUserListItem)
async def update_user_profile(
    user_id: str,
    data: AdminUpdateUserRequest,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit a user's general profile fields (username/email on the User
    row, first/last name on their per-role profile). Only fields actually
    provided in the request are changed - omit a field to leave it as-is."""
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if data.username and data.username != target.username:
        existing = await db.execute(select(User).where(User.username == data.username, User.id != target.id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
        target.username = data.username

    if data.email and data.email != target.email:
        existing = await db.execute(select(User).where(User.email == data.email, User.id != target.id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        target.email = data.email

    if data.first_name is not None or data.last_name is not None:
        profile_model = {"student": StudentProfile, "professor": ProfessorProfile, "admin": AdminProfile}.get(target.role)
        if profile_model:
            profile = (
                await db.execute(select(profile_model).where(profile_model.user_id == target.id))
            ).scalar_one_or_none()
            if not profile:
                profile = profile_model(user_id=target.id)
                db.add(profile)
            if data.first_name is not None:
                profile.first_name = data.first_name
            if data.last_name is not None:
                profile.last_name = data.last_name

    await db.commit()
    await db.refresh(target)
    return await _build_user_item(db, target)


@router.patch("/users/{user_id}/password")
async def set_user_password(
    user_id: str,
    data: AdminSetPasswordRequest,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin sets a new password for another user directly - no old
    password required, no email confirmation step (the existing self-
    service /auth/change-password flow already covers that case for an
    account owner acting on their own behalf). Blocked for your own
    account for the same reason - use the normal account settings instead."""
    if str(current_user.id) == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use your account settings to change your own password",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target.password_hash = get_password_hash(data.new_password)
    await db.commit()

    return {"message": f"Password updated for {target.username}"}


async def _cascade_delete_user_data(db: AsyncSession, user_id: str) -> None:
    """Explicit application-level cleanup for the tables that do NOT have a
    real, DB-enforced ON DELETE CASCADE pointing at users.id (verified live
    via information_schema - this app has no migration system, so a model's
    declared ondelete="CASCADE" only actually exists in Postgres for tables
    created fresh by that model; several older tables predate it and were
    never altered, the same schema-drift class of issue already found and
    worked around for messages.conversation_id / SectionService.delete_section
    earlier in this project). Every table already confirmed to have a real
    CASCADE constraint (livestreams, friends, friend_requests, blocked_users,
    conversation_members, teaching_assignments, meethub_*, stream_*,
    user_reports, and every *_reactions/*_bookmarks/*_targets table keyed off
    a post/comment/announcement/message id) is deliberately left for the
    final `DELETE FROM users` to handle - only the confirmed gaps are
    listed here, in dependency order (posts/announcements/comments/messages
    first, since deleting them safely cascades their own real FKs)."""
    # Posts: post_media/post_reactions/shares/comments (and comments' own
    # comment_reactions/replies) are all real CASCADE constraints on
    # posts.id/comments.id, so deleting the post rows here is sufficient.
    await db.execute(sa_delete(Post).where(Post.user_id == user_id))

    # Comments this user left on OTHERS' posts (not swept by the delete
    # above, which only covers the user's own posts). Real CASCADE on
    # comment_reactions.comment_id and comments.parent_id handles the rest.
    await db.execute(sa_delete(Comment).where(Comment.user_id == user_id))

    # The older polymorphic Like table has no FK at all (target_id/target_type
    # is not a real foreign key), so it's never touched by any cascade above.
    await db.execute(sa_delete(Like).where(Like.user_id == user_id))

    await db.execute(sa_delete(Notification).where(Notification.user_id == user_id))

    # Announcements: announcement_targets/reactions/bookmarks are real
    # CASCADE constraints on announcements.id.
    await db.execute(sa_delete(Announcement).where(Announcement.user_id == user_id))

    # Messages this user sent, in any conversation (real CASCADE handles
    # message_reactions/message_hidden_for for these specific messages).
    await db.execute(sa_delete(Message).where(Message.sender_id == user_id))

    await db.execute(sa_delete(InvitationCode).where(InvitationCode.created_by == user_id))
    await db.execute(sa_update(InvitationCode).where(InvitationCode.used_by == user_id).values(used_by=None))

    await db.execute(sa_delete(SectionMember).where(SectionMember.user_id == user_id))
    await db.execute(sa_update(Section).where(Section.advisor_id == user_id).values(advisor_id=None))

    for profile_model in (StudentProfile, ProfessorProfile, AdminProfile):
        await db.execute(sa_delete(profile_model).where(profile_model.user_id == user_id))


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a user account and everything that references it.
    See _cascade_delete_user_data for exactly why explicit cleanup is
    needed instead of just `await db.delete(user)`."""
    if str(current_user.id) == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account")

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    username = target.username
    await _cascade_delete_user_data(db, user_id)
    await db.execute(sa_delete(User).where(User.id == user_id))
    await db.commit()

    return {"message": f"{username} has been permanently deleted"}


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


# ============================================
# ADMIN: POSTS
# ============================================

@router.get("/posts", response_model=AdminPostListResponse)
async def list_all_posts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, min_length=1),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Every post in the system, newest first - PostService.get_feed is
    intentionally visibility-scoped to one viewer, so this is a separate
    flat admin-wide listing for moderation. Reuses the posts table's own
    already-denormalized likes/comments/shares counters, same numbers the
    public feed already shows - no separate counting system."""
    query = select(Post)
    if search:
        term = f"%{search}%"
        matched_author_ids: set = set()
        for profile_model in (StudentProfile, ProfessorProfile, AdminProfile):
            result = await db.execute(
                select(profile_model.user_id).where(
                    or_(profile_model.first_name.ilike(term), profile_model.last_name.ilike(term))
                )
            )
            matched_author_ids.update(result.scalars().all())
        username_result = await db.execute(select(User.id).where(User.username.ilike(term)))
        matched_author_ids.update(username_result.scalars().all())

        conditions = [Post.content.ilike(term)]
        if matched_author_ids:
            conditions.append(Post.user_id.in_(matched_author_ids))
        query = query.where(or_(*conditions))

    query = query.order_by(Post.created_at.desc())
    all_matching = (await db.execute(query)).scalars().all()

    total = len(all_matching)
    total_pages = max(1, (total + limit - 1) // limit)
    start_idx = (page - 1) * limit
    page_posts = all_matching[start_idx:start_idx + limit]

    post_author_ids = [p.user_id for p in page_posts]
    users_by_id: dict = {}
    if post_author_ids:
        users_result = await db.execute(select(User).where(User.id.in_(post_author_ids)))
        users_by_id = {u.id: u for u in users_result.scalars().all()}

    profile_by_user: dict = {}
    for role, model in (("student", StudentProfile), ("professor", ProfessorProfile), ("admin", AdminProfile)):
        ids = [uid for uid, u in users_by_id.items() if u.role == role]
        if not ids:
            continue
        result = await db.execute(select(model).where(model.user_id.in_(ids)))
        for p in result.scalars().all():
            profile_by_user[p.user_id] = p

    items = []
    for post in page_posts:
        author = users_by_id.get(post.user_id)
        profile = profile_by_user.get(post.user_id)
        full_name = None
        avatar_url = None
        if profile and (profile.first_name or profile.last_name):
            full_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() or None
        if profile:
            avatar_url = profile.avatar_url

        items.append(AdminPostListItem(
            id=str(post.id),
            content=post.content,
            type=post.type,
            visibility=post.visibility,
            media_urls=post.media_urls or [],
            author_id=str(post.user_id),
            author_username=author.username if author else "Unknown",
            author_full_name=full_name,
            author_avatar_url=avatar_url,
            author_role=author.role if author else "student",
            likes_count=post.likes_count or 0,
            comments_count=post.comments_count or 0,
            shares_count=post.shares_count or 0,
            created_at=post.created_at,
        ))

    return AdminPostListResponse(items=items, total=total, page=page, limit=limit, total_pages=total_pages)


@router.post("/posts/bulk-delete", response_model=BulkDeletePostsResponse)
async def bulk_delete_posts(
    data: BulkDeletePostsRequest,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete exactly the given post IDs - admin-only (get_current_admin_user
    already 403s a non-admin before this body ever runs). Reuses
    PostService.delete_post/bulk_delete_posts, the same single-post deletion
    logic and DB cleanup the existing "Remove Post" action already uses, so
    there's no second deletion path to drift out of sync. A reported post's
    UserReport row is NOT deleted with it (post_id is ON DELETE SET NULL) -
    the report/moderation history is preserved for admin review exactly as
    it already is for a single delete."""
    service = PostService(db)
    result = await service.bulk_delete_posts(data.post_ids, str(current_user.id))
    return BulkDeletePostsResponse(**result)


# ============================================
# ADMIN: ANNOUNCEMENTS
# ============================================

@router.get("/announcements", response_model=AdminAnnouncementListResponse)
async def list_all_announcements(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, min_length=1),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Every announcement in the system, including other users' unpublished
    drafts - AnnouncementService.get_announcements is intentionally
    visibility/is_published-scoped for the normal feed/section-widget use
    case (and was already carefully audited for that role logic), so this
    is a separate flat read path rather than a change to that method.
    Create/update/delete still go through the existing, already-correct
    /announcements endpoints unchanged - this is read-only."""
    query = select(Announcement).options(selectinload(Announcement.targets), selectinload(Announcement.user))
    if search:
        term = f"%{search}%"
        query = query.where(or_(Announcement.title.ilike(term), Announcement.content.ilike(term)))
    query = query.order_by(Announcement.created_at.desc())

    all_matching = (await db.execute(query)).scalars().all()
    total = len(all_matching)
    total_pages = max(1, (total + limit - 1) // limit)
    start_idx = (page - 1) * limit
    page_items = all_matching[start_idx:start_idx + limit]

    section_ids = {t.target_id for a in page_items for t in (a.targets or []) if t.target_type == "section"}
    section_names_by_id: dict = {}
    if section_ids:
        result = await db.execute(select(Section.id, Section.name).where(Section.id.in_(section_ids)))
        section_names_by_id = {str(sid): name for sid, name in result.all()}

    author_ids_by_role: dict = {}
    for a in page_items:
        if a.user and a.user.role in ("student", "professor", "admin"):
            author_ids_by_role.setdefault(a.user.role, []).append(a.user_id)

    profile_by_user: dict = {}
    for role, model in (("student", StudentProfile), ("professor", ProfessorProfile), ("admin", AdminProfile)):
        ids = author_ids_by_role.get(role)
        if not ids:
            continue
        result = await db.execute(select(model).where(model.user_id.in_(ids)))
        for p in result.scalars().all():
            profile_by_user[p.user_id] = p

    items = []
    for a in page_items:
        profile = profile_by_user.get(a.user_id)
        full_name = None
        avatar_url = None
        if profile and (profile.first_name or profile.last_name):
            full_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() or None
        if profile:
            avatar_url = profile.avatar_url

        target_names = [
            section_names_by_id[str(t.target_id)] for t in (a.targets or [])
            if t.target_type == "section" and str(t.target_id) in section_names_by_id
        ]
        audience = ", ".join(target_names) if target_names else "Public"

        items.append(AdminAnnouncementListItem(
            id=str(a.id),
            title=a.title,
            content=a.content,
            type=a.type,
            priority=a.priority,
            created_by_role=a.created_by_role,
            author_id=str(a.user_id),
            author_username=a.user.username if a.user else "Unknown",
            author_full_name=full_name,
            author_avatar_url=avatar_url,
            is_published=a.is_published,
            audience=audience,
            target_section_names=target_names,
            created_at=a.created_at,
            updated_at=a.updated_at,
            expires_at=a.expires_at,
        ))

    return AdminAnnouncementListResponse(items=items, total=total, page=page, limit=limit, total_pages=total_pages)


# ============================================
# ADMIN: LIVESTREAMS / MEETHUB
# ============================================

async def _host_display(db: AsyncSession, host: Optional[User]) -> tuple[Optional[str], Optional[str]]:
    if not host:
        return None, None
    profile = await _profile_for(db, host)
    full_name = None
    avatar_url = None
    if profile and (profile.first_name or profile.last_name):
        full_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() or None
    if profile:
        avatar_url = profile.avatar_url
    return full_name, avatar_url


def _enum_value(v):
    return v.value if hasattr(v, "value") else v


async def _to_admin_livestream_item(
    db: AsyncSession, stream: Livestream, meethub: Optional[MeethubSession], ta_info: Optional[tuple]
) -> AdminLivestreamListItem:
    host = stream.host
    host_full_name, host_avatar = await _host_display(db, host)
    subject, section_name = ta_info if ta_info else (None, None)
    return AdminLivestreamListItem(
        id=str(stream.id),
        title=stream.title,
        description=stream.description,
        status=_enum_value(stream.status),
        visibility=_enum_value(stream.visibility),
        host_id=str(stream.host_id),
        host_username=host.username if host else "Unknown",
        host_full_name=host_full_name,
        host_avatar_url=host_avatar,
        viewer_count=stream.viewer_count or 0,
        started_at=stream.started_at,
        ended_at=stream.ended_at,
        created_at=stream.created_at,
        is_meethub=meethub is not None,
        section_name=section_name,
        subject=subject,
    )


@router.get("/livestreams", response_model=AdminLivestreamListResponse)
async def list_all_livestreams(
    context: str = Query("stream", pattern="^(stream|meeting)$"),
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(live|ended|scheduled)$"),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """System-wide livestream/Meethub listing for admin monitoring -
    LivestreamService.get_streams is intentionally per-viewer-visibility-
    scoped, so this is a separate flat read path (same pattern as the admin
    posts/announcements listings above). context=stream excludes Meethub
    sessions (they have their own dedicated view below); context=meeting
    returns ONLY Meethub sessions. Both are still plain Livestream rows
    underneath - MeethubSession just decorates them (see models/meethub.py)."""
    meethub_result = await db.execute(select(MeethubSession))
    meethub_sessions = meethub_result.scalars().all()
    meethub_by_stream_id = {m.livestream_id: m for m in meethub_sessions}
    meethub_stream_ids = list(meethub_by_stream_id.keys())

    query = select(Livestream).options(selectinload(Livestream.host))
    if status_filter:
        query = query.where(Livestream.status == status_filter)
    else:
        query = query.where(Livestream.status == StreamStatus.LIVE)

    if context == "stream":
        query = query.where(Livestream.id.notin_(meethub_stream_ids or [None]))
    else:
        query = query.where(Livestream.id.in_(meethub_stream_ids or [None]))

    query = query.order_by(Livestream.created_at.desc())
    streams = (await db.execute(query)).scalars().all()

    ta_ids = {m.teaching_assignment_id for m in meethub_sessions if m.teaching_assignment_id}
    ta_info_by_id: dict = {}
    if ta_ids:
        result = await db.execute(
            select(TeachingAssignment.id, TeachingAssignment.subject, Section.name)
            .join(Section, Section.id == TeachingAssignment.section_id)
            .where(TeachingAssignment.id.in_(ta_ids))
        )
        for ta_id, subject, section_name in result.all():
            ta_info_by_id[ta_id] = (subject, section_name)

    items = []
    for stream in streams:
        meethub = meethub_by_stream_id.get(stream.id)
        ta_info = ta_info_by_id.get(meethub.teaching_assignment_id) if meethub and meethub.teaching_assignment_id else None
        items.append(await _to_admin_livestream_item(db, stream, meethub, ta_info))

    return AdminLivestreamListResponse(items=items, total=len(items))


@router.post("/livestreams/{stream_id}/end", response_model=AdminLivestreamListItem)
async def admin_end_livestream(
    stream_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Force-end any livestream or Meethub meeting, regardless of host -
    reuses LivestreamService.end_stream's exact same logic (status/
    ended_at/viewer cleanup), just with the admin override now that
    get_current_admin_user has already verified this caller's role
    server-side (never trusted from the client)."""
    service = LivestreamService(db)
    stream = await service.end_stream(stream_id, str(current_user.id), is_admin=True)

    meethub_result = await db.execute(select(MeethubSession).where(MeethubSession.livestream_id == stream.id))
    meethub = meethub_result.scalar_one_or_none()
    ta_info = None
    if meethub and meethub.teaching_assignment_id:
        result = await db.execute(
            select(TeachingAssignment.subject, Section.name)
            .join(Section, Section.id == TeachingAssignment.section_id)
            .where(TeachingAssignment.id == meethub.teaching_assignment_id)
        )
        row = result.first()
        if row:
            ta_info = (row[0], row[1])

    return await _to_admin_livestream_item(db, stream, meethub, ta_info)


@router.get("/livestreams/{stream_id}/viewers", response_model=List[AdminStreamViewerItem])
async def admin_stream_viewers(
    stream_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Current participant roster for any stream/meeting - admin-only, and
    deliberately independent of LivestreamService.can_view_stream (an admin
    can inspect any session's participants regardless of its visibility)."""
    result = await db.execute(
        select(StreamViewer).where(StreamViewer.stream_id == stream_id, StreamViewer.is_active == True)  # noqa: E712
    )
    viewers = result.scalars().all()
    if not viewers:
        return []

    user_ids = [v.user_id for v in viewers]
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_by_id = {u.id: u for u in users_result.scalars().all()}

    items = []
    for v in viewers:
        u = users_by_id.get(v.user_id)
        full_name, avatar_url = await _host_display(db, u)
        items.append(AdminStreamViewerItem(
            user_id=str(v.user_id),
            username=u.username if u else "Unknown",
            full_name=full_name,
            avatar_url=avatar_url,
            joined_at=v.joined_at,
            is_active=v.is_active,
        ))
    return items


# ============================================
# ADMIN: REPORTS
# ============================================

@router.get("/reports", response_model=AdminReportListResponse)
async def list_reports(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = Query(None),
    report_status: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None, min_length=1),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """User-submitted reports (against a user, or - when post_id is set -
    against one of their posts) - surfaces the existing user_reports table,
    extended with a moderation workflow (see UserReport/ModerationService).
    reporter_id is intentionally never selected/returned anywhere below -
    the reported user and other admins must never learn who filed a
    report, only what was reported and why."""
    query = select(UserReport).order_by(UserReport.created_at.desc())
    if category:
        query = query.where(UserReport.reason == category)
    if report_status:
        query = query.where(UserReport.status == report_status)
    all_matching = (await db.execute(query)).scalars().all()

    reported_ids = {r.reported_id for r in all_matching}
    post_ids = {r.post_id for r in all_matching if r.post_id}

    users_by_id: dict = {}
    if reported_ids:
        result = await db.execute(select(User).where(User.id.in_(reported_ids)))
        users_by_id = {u.id: u for u in result.scalars().all()}

    profile_by_user: dict = {}
    for role, model in (("student", StudentProfile), ("professor", ProfessorProfile), ("admin", AdminProfile)):
        ids = [uid for uid, u in users_by_id.items() if u.role == role]
        if not ids:
            continue
        result = await db.execute(select(model).where(model.user_id.in_(ids)))
        for p in result.scalars().all():
            profile_by_user[p.user_id] = p

    posts_by_id: dict = {}
    if post_ids:
        result = await db.execute(select(Post).where(Post.id.in_(post_ids)))
        posts_by_id = {p.id: p for p in result.scalars().all()}

    if search:
        term = search.lower()

        def _matches(r: UserReport) -> bool:
            u = users_by_id.get(r.reported_id)
            uname = (u.username if u else "").lower()
            label = CATEGORY_LABELS.get(r.reason, r.reason).lower()
            post = posts_by_id.get(r.post_id) if r.post_id else None
            content = (post.content or "").lower() if post else ""
            return term in uname or term in label or term in content

        all_matching = [r for r in all_matching if _matches(r)]

    total = len(all_matching)
    total_pages = max(1, (total + limit - 1) // limit)
    start_idx = (page - 1) * limit
    page_items = all_matching[start_idx:start_idx + limit]

    restriction_ids = {r.restriction_id for r in page_items if r.restriction_id}
    restrictions_by_id: dict = {}
    if restriction_ids:
        result = await db.execute(select(UserRestriction).where(UserRestriction.id.in_(restriction_ids)))
        restrictions_by_id = {res.id: res for res in result.scalars().all()}

    items = []
    for r in page_items:
        u = users_by_id.get(r.reported_id)
        profile = profile_by_user.get(r.reported_id)
        full_name = None
        avatar_url = None
        if profile and (profile.first_name or profile.last_name):
            full_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() or None
        if profile:
            avatar_url = profile.avatar_url

        reported_post = None
        if r.post_id:
            post = posts_by_id.get(r.post_id)
            reported_post = AdminReportedPost(
                id=str(r.post_id),
                content=post.content if post else None,
                media_urls=(post.media_urls or []) if post else [],
                exists=post is not None,
                created_at=post.created_at if post else None,
            )
        elif r.removed_post_content is not None or r.removed_post_media_urls:
            # post_id was nulled by the posts table's ON DELETE SET NULL the
            # moment the row was actually deleted - the snapshot captured at
            # removal time (see ModerationService.remove_reported_post) is
            # all that's left to show, so use it instead of an empty card.
            reported_post = AdminReportedPost(
                id=None,
                content=r.removed_post_content,
                media_urls=r.removed_post_media_urls or [],
                exists=False,
                created_at=None,
                removed_by_moderation=True,
            )

        restriction = None
        res = restrictions_by_id.get(r.restriction_id) if r.restriction_id else None
        if res:
            restriction = AdminReportRestriction(
                reason=res.reason,
                restricted_at=res.restricted_at,
                restricted_until=res.restricted_until,
            )

        items.append(AdminReportListItem(
            id=str(r.id),
            category=r.reason,
            category_label=CATEGORY_LABELS.get(r.reason, r.reason),
            priority="high" if r.reason in HIGH_PRIORITY_CATEGORIES else "normal",
            details=r.details,
            status=r.status,
            reported_user=AdminReportedUser(
                id=str(r.reported_id),
                username=u.username if u else "Unknown",
                full_name=full_name,
                avatar_url=avatar_url,
                role=u.role if u else "student",
            ),
            reported_post=reported_post,
            created_at=r.created_at,
            moderated_at=r.moderated_at,
            warning_issued=r.warning_issued,
            post_removed=r.post_removed,
            restriction=restriction,
            admin_message=r.admin_message,
        ))

    return AdminReportListResponse(items=items, total=total, page=page, limit=limit, total_pages=total_pages)


# ============================================
# ADMIN: REPORT MODERATION ACTIONS
# ============================================

@router.post("/reports/{report_id}/dismiss", response_model=ModerationActionResponse)
async def dismiss_report_action(
    report_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a report invalid - no restriction/warning is applied."""
    service = ModerationService(db)
    report = await service.dismiss_report(report_id, str(current_user.id))
    return ModerationActionResponse(
        id=str(report.id), status=report.status, warning_issued=report.warning_issued,
        post_removed=report.post_removed, message="Report dismissed.",
    )


@router.post("/reports/{report_id}/validate", response_model=ModerationActionResponse)
async def validate_report_action(
    report_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a report as a confirmed violation, with no further action yet."""
    service = ModerationService(db)
    report = await service.validate_report(report_id, str(current_user.id))
    return ModerationActionResponse(
        id=str(report.id), status=report.status, warning_issued=report.warning_issued,
        post_removed=report.post_removed, message="Report marked as valid.",
    )


@router.post("/reports/{report_id}/warn", response_model=ModerationActionResponse)
async def warn_report_action(
    report_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Send the reported user a moderation-warning notification. Never
    reveals the reporter - the notification only references the report_id."""
    service = ModerationService(db)
    report = await service.issue_warning(report_id, str(current_user.id))
    return ModerationActionResponse(
        id=str(report.id), status=report.status, warning_issued=report.warning_issued,
        post_removed=report.post_removed, message="Warning sent to the reported user.",
    )


@router.post("/reports/{report_id}/confirm-violation", response_model=ModerationActionResponse)
async def confirm_violation_action(
    report_id: str,
    data: ConfirmViolationRequest,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Send the reported user a "Post Violation" notice with the admin's own
    explanation - separate from Send Warning/Restrict User, this is purely
    about communicating WHY their post was found to violate guidelines and
    WHICH post, without exposing the reporter."""
    service = ModerationService(db)
    report = await service.confirm_violation(report_id, str(current_user.id), data.message)
    return ModerationActionResponse(
        id=str(report.id), status=report.status, warning_issued=report.warning_issued,
        post_removed=report.post_removed, message="Violation notice sent to the reported user.",
    )


@router.post("/reports/{report_id}/restrict", response_model=ModerationActionResponse)
async def restrict_report_action(
    report_id: str,
    data: RestrictUserRequest,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply a time-boxed social-interaction restriction to the reported
    user (1 day / 1 week / 1 month) - enforced backend-wide via
    ModerationService.get_active_restriction, not just a frontend disable."""
    service = ModerationService(db)
    report = await service.restrict_user(report_id, str(current_user.id), data.duration)
    return ModerationActionResponse(
        id=str(report.id), status=report.status, warning_issued=report.warning_issued,
        post_removed=report.post_removed, message="User restricted.",
    )


@router.post("/reports/{report_id}/remove-post", response_model=ModerationActionResponse)
async def remove_reported_post_action(
    report_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete the reported post - reuses PostService.delete_post (admin can
    already delete any post) rather than a second deletion path."""
    service = ModerationService(db)
    report = await service.remove_reported_post(report_id, str(current_user.id))
    return ModerationActionResponse(
        id=str(report.id), status=report.status, warning_issued=report.warning_issued,
        post_removed=report.post_removed, message="Post removed.",
    )
