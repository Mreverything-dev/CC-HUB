# backend/app/database/repositories/user_repository.py
import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.database.repositories.base_repository import BaseRepository

class UserRepository(BaseRepository[User]):
    """
    Repository for User model with additional methods.
    """
    
    def __init__(self, db: AsyncSession):
        super().__init__(User, db)

    async def get_by_email(self, email: str) -> User | None:
        """Get user by email."""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> User | None:
        """Get user by username."""
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def get_active_users(self) -> list[User]:
        """Get all active users."""
        result = await self.db.execute(
            select(User).where(User.is_active == True)
        )
        return result.scalars().all()

    async def update_last_login(self, user_id: str) -> None:
        """Update user's last login timestamp."""
        user = await self.get(user_id)
        if user:
            user.last_login = datetime.utcnow()
            await self.db.commit()