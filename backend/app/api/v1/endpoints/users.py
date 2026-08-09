# backend/app/api/v1/endpoints/users.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import UserResponse
from typing import List

router = APIRouter()

@router.get("/search", response_model=List[UserResponse])
async def search_users(
    q: str = Query(..., min_length=2),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Search users by email or username"""
    search_term = f"%{q}%"
    result = await db.execute(
        select(User).where(
            or_(
                User.email.ilike(search_term),
                User.username.ilike(search_term)
            )
        ).limit(20)
    )
    return result.scalars().all()