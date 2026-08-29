# backend/app/services/profile_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.user import User
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.schemas.profile import (
    StudentProfileCreate, StudentProfileUpdate, StudentProfileResponse,
    ProfessorProfileCreate, ProfessorProfileUpdate, ProfessorProfileResponse,
    AdminProfileCreate, AdminProfileUpdate, AdminProfileResponse,
    UserProfileResponse
)
from fastapi import HTTPException, status
from datetime import datetime
from typing import Optional
class ProfileService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ============================================
    # GET PROFILE
    # ============================================
    
    async def get_user_profile(self, user_id: str, requesting_user: Optional[User] = None) -> UserProfileResponse:
        """Get user profile based on role. Email is only included for the
        profile owner or an admin - any other authenticated viewer gets
        every other field (username, role, bio, avatar, etc.) but an empty
        email, since email is PII this endpoint was never meant to expose
        to arbitrary other users."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        is_owner_or_admin = (
            requesting_user is not None
            and (str(requesting_user.id) == str(user.id) or requesting_user.role == "admin")
        )

        profile = None
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
        
        return {
            "user_id": str(user.id),
            "email": user.email if is_owner_or_admin else "",
            "username": user.username,
            "role": user.role,
            "profile": profile
        }

    # ============================================
    # STUDENT PROFILE CRUD
    # ============================================
    
    async def create_student_profile(self, data: StudentProfileCreate, requesting_user_id: str) -> StudentProfile:
        """Create student profile. Always uses the authenticated caller's own
        id - the `user_id` field on `data` is ignored so one account can't
        create/populate another account's profile row."""
        # Check if user exists
        result = await self.db.execute(
            select(User).where(User.id == requesting_user_id)
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
            select(StudentProfile).where(StudentProfile.user_id == requesting_user_id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student profile already exists"
            )

        # Check if student_id is unique
        if data.student_id:
            result = await self.db.execute(
                select(StudentProfile).where(StudentProfile.student_id == data.student_id)
            )
            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Student ID already exists"
                )

        profile_data = data.model_dump()
        profile_data["user_id"] = requesting_user_id
        profile = StudentProfile(**profile_data)
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile

    async def get_student_profile(self, user_id: str) -> StudentProfile:
        """Get student profile"""
        result = await self.db.execute(
            select(StudentProfile).where(StudentProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found"
            )
        return profile

    async def update_student_profile(self, user_id: str, data: StudentProfileUpdate) -> StudentProfile:
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
        
        # Check if student_id is unique (if changing)
        if data.student_id and data.student_id != profile.student_id:
            result = await self.db.execute(
                select(StudentProfile).where(StudentProfile.student_id == data.student_id)
            )
            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Student ID already exists"
                )
        
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(profile, key, value)
        
        profile.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(profile)
        return profile

    # ============================================
    # PROFESSOR PROFILE CRUD
    # ============================================
    
    async def create_professor_profile(self, data: ProfessorProfileCreate, requesting_user_id: str) -> ProfessorProfile:
        """Create professor profile. Always uses the authenticated caller's
        own id - the `user_id` field on `data` is ignored so one account
        can't create/populate another account's profile row."""
        result = await self.db.execute(
            select(User).where(User.id == requesting_user_id)
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
            select(ProfessorProfile).where(ProfessorProfile.user_id == requesting_user_id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Professor profile already exists"
            )

        if data.employee_id:
            result = await self.db.execute(
                select(ProfessorProfile).where(ProfessorProfile.employee_id == data.employee_id)
            )
            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Employee ID already exists"
                )

        profile_data = data.model_dump()
        profile_data["user_id"] = requesting_user_id
        profile = ProfessorProfile(**profile_data)
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile

    async def get_professor_profile(self, user_id: str) -> ProfessorProfile:
        """Get professor profile"""
        result = await self.db.execute(
            select(ProfessorProfile).where(ProfessorProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Professor profile not found"
            )
        return profile

    async def update_professor_profile(self, user_id: str, data: ProfessorProfileUpdate) -> ProfessorProfile:
        """Update professor profile"""
        result = await self.db.execute(
            select(ProfessorProfile).where(ProfessorProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Professor profile not found"
            )
        
        if data.employee_id and data.employee_id != profile.employee_id:
            result = await self.db.execute(
                select(ProfessorProfile).where(ProfessorProfile.employee_id == data.employee_id)
            )
            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Employee ID already exists"
                )
        
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(profile, key, value)
        
        profile.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(profile)
        return profile

    # ============================================
    # ADMIN PROFILE CRUD
    # ============================================
    
    async def create_admin_profile(self, data: AdminProfileCreate, requesting_user_id: str) -> AdminProfile:
        """Create admin profile. Always uses the authenticated caller's own
        id - the `user_id` field on `data` is ignored so one account can't
        create/populate another account's profile row."""
        result = await self.db.execute(
            select(User).where(User.id == requesting_user_id)
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
            select(AdminProfile).where(AdminProfile.user_id == requesting_user_id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin profile already exists"
            )

        profile_data = data.model_dump()
        profile_data["user_id"] = requesting_user_id
        profile = AdminProfile(**profile_data)
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile

    async def get_admin_profile(self, user_id: str) -> AdminProfile:
        """Get admin profile"""
        result = await self.db.execute(
            select(AdminProfile).where(AdminProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Admin profile not found"
            )
        return profile

    async def update_admin_profile(self, user_id: str, data: AdminProfileUpdate) -> AdminProfile:
        """Update admin profile"""
        result = await self.db.execute(
            select(AdminProfile).where(AdminProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Admin profile not found"
            )
        
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(profile, key, value)
        
        profile.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(profile)
        return profile