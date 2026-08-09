# backend/seed_users.py
import asyncio
import bcrypt
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.user import User
from app.core.config import settings

async def seed_users():
    print("🌱 Seeding default users...")
    
    DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    users_data = [
        {
            "email": "admin@ccshub.edu.ph",
            "username": "admin",
            "password": "Admin@123",
            "role": "admin",
            "is_active": True,
            "is_verified": True
        },
        {
            "email": "professor@ccshub.edu.ph",
            "username": "professor",
            "password": "Professor@123",
            "role": "professor",
            "is_active": True,
            "is_verified": True
        },
        {
            "email": "student@ccshub.edu.ph",
            "username": "student",
            "password": "Student@123",
            "role": "student",
            "is_active": True,
            "is_verified": True
        }
    ]
    
    try:
        async with async_session() as db:
            for user_data in users_data:
                # Check if user exists
                result = await db.execute(
                    select(User).where(User.email == user_data["email"])
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    print(f"⚠️ User {user_data['email']} already exists")
                    continue
                
                # Hash password
                password_bytes = user_data["password"].encode('utf-8')
                salt = bcrypt.gensalt()
                hashed_password = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
                
                # Create user
                user = User(
                    email=user_data["email"],
                    username=user_data["username"],
                    password_hash=hashed_password,
                    role=user_data["role"],
                    is_active=user_data["is_active"],
                    is_verified=user_data["is_verified"]
                )
                db.add(user)
                print(f"✅ Created user: {user_data['email']} ({user_data['role']})")
            
            await db.commit()
            print("\n✅ All users seeded successfully!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_users())