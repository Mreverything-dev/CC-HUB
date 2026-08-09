# backend/test_db_connection.py
import asyncio

from sqlalchemy import text

from app.core.database import AsyncSessionLocal, Base, engine


async def test_connection():
    """Test database connection."""
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            print("Database connection successful!")
            print(f"Result: {result.scalar()}")

        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"Database version: {version}")

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            print("Tables created successfully!")

    except Exception as e:
        print(f"Database connection failed: {e}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(test_connection())
