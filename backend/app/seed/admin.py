# backend/app/seed/admin.py
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, Role

logger = logging.getLogger(__name__)


async def seed_admin(db: AsyncSession):
    """Seed default superadmin user linked to the admin role"""

    # 1. Check if the admin user already exists by email
    result = await db.execute(
        select(User).where(User.email == settings.FIRST_SUPERUSER_EMAIL)
    )
    admin_user = result.scalar_one_or_none()

    if not admin_user:
        # 2. Fetch the 'admin' role created by seed_roles
        role_result = await db.execute(
            select(Role).where(Role.name == "admin")
        )
        admin_role = role_result.scalar_one_or_none()

        if not admin_role:
            logger.error("❌ Cannot seed admin user: 'admin' role does not exist yet. Ensure seed_roles runs first.")
            return

        # 3. Hash password and instantiate User
        hashed_pw = get_password_hash(settings.FIRST_SUPERUSER_PASSWORD)

        new_admin = User(
            email=settings.FIRST_SUPERUSER_EMAIL,
            username="admin",  # Required non-null column
            password_hash=hashed_pw,  # Matches User.password_hash
            is_active=True,
            is_verified=True,  # Bypass verification for superadmin
            role="admin",  # Matches the varchar column in users table
            roles=[admin_role],  # Assigns many-to-many relationship via user_roles table
        )

        db.add(new_admin)
        await db.commit()
        logger.info(f"✅ Default admin account created: {settings.FIRST_SUPERUSER_EMAIL}")
    else:
        logger.info("ℹ️ Default admin account already exists. Skipping.")