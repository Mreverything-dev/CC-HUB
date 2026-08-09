# backend/debug_register.py
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.user import User
from app.core.security import get_password_hash
from app.core.config import settings

async def test_register():
    print("🧪 Testing registration directly...")
    
    # Create engine
    DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    try:
        async with async_session() as db:
            # Check if user exists
            from sqlalchemy import select
            result = await db.execute(
                select(User).where(User.email == "test@ccshub.edu.ph")
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"❌ User already exists: {existing.email}")
                return
            
            # Create user
            user = User(
                email="test12ccshub@gmail.com",
                username="testuser21",
                password_hash=get_password_hash("Testuser@123"),
                role="student"
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            
            print(f"✅ User created successfully!")
            print(f"   ID: {user.id}")
            print(f"   Email: {user.email}")
            print(f"   Username: {user.username}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_register())