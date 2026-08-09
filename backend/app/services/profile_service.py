from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.schemas.profile import (
    StudentProfileCreate, StudentProfileUpdate, StudentProfileResponse,
    ProfessorProfileCreate, ProfessorProfileUpdate, ProfessorProfileResponse,
    AdminProfileCreate, AdminProfileUpdate, AdminProfileResponse,
    UserProfileResponse
)
from fastapi import HTTPException, status

class ProfileService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_profile(self, user_id: str):
        """Get user profile based on role"""
        # Get user
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get profile based on role
        if user.role == "student":
            result = await self.db.execute(
                select(StudentProfile).where(StudentProfile.user_id == user_id)
            )
            profile = result.scalar_one_or_none()
        elif user.role == "professor":
            result = await self.db.execute(
                select(ProfessorProfile).where(ProfessorProfile.user_id == user_id)
            )
            profile = result.scalar_one_or_none()
        elif user.role == "admin":
            result = await self.db.execute(
                select(AdminProfile).where(AdminProfile.user_id == user_id)
            )
            profile = result.scalar_one_or_none()
        else:
            profile = None
        
        return {
            "user_id": str(user.id),
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "profile": profile
        }

    async def create_student_profile(self, data: StudentProfileCreate):
        """Create student profile"""
        # Check if user exists
        result = await self.db.execute(
            select(User).where(User.id == data.user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user.role != "student":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not a student"
            )
        
        # Check if profile exists
        result = await self.db.execute(
            select(StudentProfile).where(StudentProfile.user_id == data.user_id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student profile already exists"
            )
        
        profile = StudentProfile(**data.model_dump())
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile

    async def update_student_profile(self, user_id: str, data: StudentProfileUpdate):
        """Update student profile"""
        result = await self.db.execute(
            select(StudentProfile).where(StudentProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found"
            )
        
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(profile, key, value)
        
        await self.db.commit()
        await self.db.refresh(profile)
        return profile

    async def create_professor_profile(self, data: ProfessorProfileCreate):
        """Create professor profile"""
        result = await self.db.execute(
            select(User).where(User.id == data.user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user.role != "professor":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not a professor"
            )
        
        result = await self.db.execute(
            select(ProfessorProfile).where(ProfessorProfile.user_id == data.user_id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Professor profile already exists"
            )
        
        profile = ProfessorProfile(**data.model_dump())
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile

    async def create_admin_profile(self, data: AdminProfileCreate):
        """Create admin profile"""
        result = await self.db.execute(
            select(User).where(User.id == data.user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not an admin"
            )
        
        result = await self.db.execute(
            select(AdminProfile).where(AdminProfile.user_id == data.user_id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin profile already exists"
            )
        
        profile = AdminProfile(**data.model_dump())
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile