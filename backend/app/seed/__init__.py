# backend/app/seed/__init__.py
from sqlalchemy.ext.asyncio import AsyncSession
from app.seed.roles import seed_roles, seed_permissions
from app.seed.admin import seed_admin

async def seed_all(db: AsyncSession):
    """Run all seeders in correct sequence"""
    await seed_permissions(db)
    await seed_roles(db)
    await seed_admin(db)  # Runs last so the 'admin' role exists