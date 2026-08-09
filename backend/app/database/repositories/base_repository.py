# backend/app/database/repositories/base_repository.py
from typing import TypeVar, Generic, Type, Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.core.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Base repository with common CRUD operations.
    """

    def __init__(self, model: Type[ModelType], db: AsyncSession):
        self.model = model
        self.db = db

    async def create(self, **kwargs) -> ModelType:
        """Create a new record."""
        instance = self.model(**kwargs)
        self.db.add(instance)
        await self.db.commit()
        await self.db.refresh(instance)
        return instance

    async def get(self, id: str) -> Optional[ModelType]:
        """Get a record by ID."""
        result = await self.db.execute(select(self.model).where(self.model.id == id))
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 100) -> List[ModelType]:
        """Get all records with pagination."""
        result = await self.db.execute(select(self.model).offset(skip).limit(limit))
        return result.scalars().all()

    async def update(self, id: str, **kwargs) -> Optional[ModelType]:
        """Update a record."""
        result = await self.db.execute(
            update(self.model)
            .where(self.model.id == id)
            .values(**kwargs)
            .returning(self.model)
        )
        await self.db.commit()
        return result.scalar_one_or_none()

    async def delete(self, id: str) -> bool:
        """Delete a record."""
        result = await self.db.execute(delete(self.model).where(self.model.id == id))
        await self.db.commit()
        return result.rowcount > 0

    async def exists(self, **filters) -> bool:
        """Check if a record exists."""
        query = select(self.model)
        for key, value in filters.items():
            query = query.where(getattr(self.model, key) == value)
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

