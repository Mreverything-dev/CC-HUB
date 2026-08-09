# backend/app/seed/roles.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import Role, Permission

async def seed_roles(db: AsyncSession):
    """Seed default roles and permissions"""
    
    # Default roles
    roles_data = [
        {"name": "admin", "description": "Administrator with full access"},
        {"name": "professor", "description": "Professor with teaching privileges"},
        {"name": "student", "description": "Student with basic access"},
    ]
    
    for role_data in roles_data:
        result = await db.execute(
            select(Role).where(Role.name == role_data["name"])
        )
        if not result.scalar_one_or_none():
            role = Role(**role_data)
            db.add(role)
    
    await db.commit()

async def seed_permissions(db: AsyncSession):
    """Seed default permissions"""
    
    permissions_data = [
        {"name": "create_post", "resource": "post", "action": "create"},
        {"name": "edit_post", "resource": "post", "action": "edit"},
        {"name": "delete_post", "resource": "post", "action": "delete"},
        {"name": "view_post", "resource": "post", "action": "view"},
        {"name": "create_comment", "resource": "comment", "action": "create"},
        {"name": "edit_comment", "resource": "comment", "action": "edit"},
        {"name": "delete_comment", "resource": "comment", "action": "delete"},
        {"name": "manage_users", "resource": "user", "action": "manage"},
        {"name": "manage_roles", "resource": "role", "action": "manage"},
    ]
    
    for perm_data in permissions_data:
        result = await db.execute(
            select(Permission).where(Permission.name == perm_data["name"])
        )
        if not result.scalar_one_or_none():
            perm = Permission(**perm_data)
            db.add(perm)
    
    await db.commit()