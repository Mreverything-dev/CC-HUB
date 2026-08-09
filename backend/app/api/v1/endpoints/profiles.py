from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services.profile_service import ProfileService
from app.schemas.profile import (
    StudentProfileCreate, StudentProfileUpdate, StudentProfileResponse,
    ProfessorProfileCreate, ProfessorProfileUpdate, ProfessorProfileResponse,
    AdminProfileCreate, AdminProfileUpdate, AdminProfileResponse,
    UserProfileResponse
)

router = APIRouter()

@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's profile"""
    service = ProfileService(db)
    return await service.get_user_profile(str(current_user.id))

@router.get("/{user_id}", response_model=UserProfileResponse)
async def get_user_profile(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get any user's profile (requires authentication)"""
    service = ProfileService(db)
    return await service.get_user_profile(user_id)

# Student Profile Endpoints
@router.post("/student", response_model=StudentProfileResponse)
async def create_student_profile(
    data: StudentProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create student profile"""
    service = ProfileService(db)
    return await service.create_student_profile(data)

@router.put("/student", response_model=StudentProfileResponse)
async def update_student_profile(
    data: StudentProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update student profile"""
    service = ProfileService(db)
    return await service.update_student_profile(str(current_user.id), data)

# Professor Profile Endpoints
@router.post("/professor", response_model=ProfessorProfileResponse)
async def create_professor_profile(
    data: ProfessorProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create professor profile"""
    service = ProfileService(db)
    return await service.create_professor_profile(data)

@router.put("/professor", response_model=ProfessorProfileResponse)
async def update_professor_profile(
    data: ProfessorProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update professor profile"""
    service = ProfileService(db)
    return await service.update_professor_profile(str(current_user.id), data)

# Admin Profile Endpoints
@router.post("/admin", response_model=AdminProfileResponse)
async def create_admin_profile(
    data: AdminProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create admin profile"""
    service = ProfileService(db)
    return await service.create_admin_profile(data)

@router.put("/admin", response_model=AdminProfileResponse)
async def update_admin_profile(
    data: AdminProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update admin profile"""
    service = ProfileService(db)
    return await service.update_admin_profile(str(current_user.id), data)