# backend/app/api/v1/endpoints/users.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.models.friend import BlockedUser
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.schemas.auth import UserSearchResult
from typing import List, Optional

router = APIRouter()

PROFILE_MODEL_BY_ROLE = {
    "student": StudentProfile,
    "professor": ProfessorProfile,
    "admin": AdminProfile,
}

@router.get("/search", response_model=List[UserSearchResult])
async def search_users(
    q: str = Query(..., min_length=2),
    role: Optional[str] = Query(None, pattern="^(student|professor|admin)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Search users by username, email, or full name (first/last name from
    their role-specific profile), optionally scoped to one role. Results are
    enriched with first_name/last_name/avatar_url from that profile, so
    callers (e.g. Add Student, Find People) can show a real name and avatar
    instead of just a username."""
    term = f"%{q}%"

    name_match_ids: set[str] = set()
    for profile_model in (StudentProfile, ProfessorProfile, AdminProfile):
        result = await db.execute(
            select(profile_model.user_id).where(
                or_(profile_model.first_name.ilike(term), profile_model.last_name.ilike(term))
            )
        )
        name_match_ids.update(str(r) for r in result.scalars().all())

    conditions = [User.email.ilike(term), User.username.ilike(term)]
    if name_match_ids:
        conditions.append(User.id.in_(name_match_ids))

    # Excludes both directions of any block involving the caller - mirrors
    # FriendService.suggest_friends' own exclusion (friend_service.py) so a
    # blocked user can't still be found through search, which previously
    # had no such check at all despite being reused by Find People/Add
    # Student and (now) the dashboard's global search.
    blocked_result = await db.execute(
        select(BlockedUser.blocker_id, BlockedUser.blocked_id).where(
            or_(BlockedUser.blocker_id == current_user.id, BlockedUser.blocked_id == current_user.id)
        )
    )
    excluded_ids = {str(current_user.id)}
    for blocker_id, blocked_id in blocked_result.all():
        excluded_ids.add(str(blocker_id))
        excluded_ids.add(str(blocked_id))

    query = select(User).where(or_(*conditions), User.id.notin_(excluded_ids))
    if role:
        query = query.where(User.role == role)
    query = query.limit(20)

    result = await db.execute(query)
    users = result.scalars().all()

    responses = []
    for user in users:
        first_name = last_name = avatar_url = None
        profile_model = PROFILE_MODEL_BY_ROLE.get(user.role)
        if profile_model:
            profile_result = await db.execute(
                select(profile_model).where(profile_model.user_id == user.id)
            )
            profile = profile_result.scalar_one_or_none()
            if profile:
                first_name = profile.first_name
                last_name = profile.last_name
                avatar_url = profile.avatar_url

        responses.append(UserSearchResult(
            id=user.id,
            email=user.email,
            username=user.username,
            role=user.role,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at,
            first_name=first_name,
            last_name=last_name,
            avatar_url=avatar_url,
        ))
    return responses
