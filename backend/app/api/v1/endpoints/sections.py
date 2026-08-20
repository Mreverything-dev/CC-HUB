# backend/app/api/v1/endpoints/sections.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services.section_service import SectionService
from app.services.teaching_assignment_service import TeachingAssignmentService
from app.schemas.section import (
    SectionCreate, SectionUpdate, SectionResponse,
    SectionMemberCreate, SectionMemberUpdate, SectionMemberResponse,
    SectionBrowseItem, TeachingAssignmentCreate, TeachingAssignmentResponse
)
from typing import List, Optional

router = APIRouter()

# ============================================
# SECTION ENDPOINTS
# ============================================

@router.get("/", response_model=List[SectionResponse])
async def get_sections(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all sections for the current user"""
    service = SectionService(db)
    return await service.get_sections(str(current_user.id), skip, limit)

# NOTE: registered before GET /{section_id} - a path param matches any single
# segment, so "browse" would otherwise be swallowed as a section_id lookup.
@router.get("/browse", response_model=List[SectionBrowseItem])
async def browse_sections(
    year_level: Optional[int] = Query(None, ge=1, le=6),
    name: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Platform-wide section listing for the Join Existing Section flow and
    the Create Section duplicate-name check (professors and admins only)"""
    if current_user.role not in ["professor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only professors and admins can browse sections"
        )
    service = SectionService(db)
    return await service.browse_sections(str(current_user.id), year_level, name)

@router.get("/{section_id}", response_model=SectionResponse)
async def get_section(
    section_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a section by ID with members"""
    service = SectionService(db)
    return await service.get_section(section_id, str(current_user.id))

@router.post("/", response_model=SectionResponse, status_code=status.HTTP_201_CREATED)
async def create_section(
    data: SectionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new section (Professors and Admins)"""
    if current_user.role not in ["professor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only professors and admins can create sections"
        )
    
    service = SectionService(db)
    return await service.create_section(data, str(current_user.id))

@router.put("/{section_id}", response_model=SectionResponse)
async def update_section(
    section_id: str,
    data: SectionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a section"""
    service = SectionService(db)
    return await service.update_section(section_id, data, str(current_user.id))

@router.delete("/{section_id}")
async def delete_section(
    section_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a section"""
    service = SectionService(db)
    return await service.delete_section(section_id, str(current_user.id))

# ============================================
# MEMBER ENDPOINTS
# ============================================

@router.get("/{section_id}/members", response_model=List[SectionMemberResponse])
async def get_section_members(
    section_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all members of a section"""
    service = SectionService(db)
    section = await service.get_section(section_id, str(current_user.id))
    return section.get("members", [])

@router.post("/{section_id}/members", response_model=SectionMemberResponse)
async def add_member(
    section_id: str,
    data: SectionMemberCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a member to a section"""
    service = SectionService(db)
    return await service.add_member(section_id, data.user_id, str(current_user.id))

@router.delete("/{section_id}/members/{user_id}")
async def remove_member(
    section_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a member from a section"""
    service = SectionService(db)
    return await service.remove_member(section_id, user_id, str(current_user.id))

# ============================================
# PROMOTION ENDPOINTS
# ============================================

@router.post("/{section_id}/members/{user_id}/promote-officer")
async def promote_to_officer(
    section_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Promote a student to officer"""
    service = SectionService(db)
    return await service.promote_to_officer(section_id, user_id, str(current_user.id))

@router.post("/{section_id}/members/{user_id}/demote-officer")
async def demote_officer(
    section_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Demote an officer back to student"""
    service = SectionService(db)
    return await service.demote_officer(section_id, user_id, str(current_user.id))

@router.post("/{section_id}/members/{user_id}/promote-mayor")
async def promote_to_mayor(
    section_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Promote a student to class mayor"""
    service = SectionService(db)
    return await service.promote_to_mayor(section_id, user_id, str(current_user.id))

@router.post("/{section_id}/members/{user_id}/demote-mayor")
async def demote_mayor(
    section_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Demote a mayor back to student"""
    service = SectionService(db)
    return await service.demote_mayor(section_id, user_id, str(current_user.id))

# ============================================
# TEACHING ASSIGNMENT ENDPOINTS (nested under a section)
# ============================================

@router.post("/{section_id}/teaching-assignments", response_model=TeachingAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def join_section(
    section_id: str,
    data: TeachingAssignmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a teaching assignment - a professor joining an existing
    section (or an admin assigning one on a professor's behalf)"""
    service = TeachingAssignmentService(db)
    return await service.create_assignment(section_id, data, current_user)

@router.get("/{section_id}/teaching-assignments", response_model=List[TeachingAssignmentResponse])
async def get_section_teaching_assignments(
    section_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all professors teaching a section, via their teaching assignments"""
    service = TeachingAssignmentService(db)
    return await service.list_for_section(section_id)