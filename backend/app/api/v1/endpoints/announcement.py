# backend/app/api/v1/endpoints/announcements.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services.announcement_service import AnnouncementService
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementUpdate,
    AnnouncementResponse,
    AnnouncementListResponse,
    AnnouncementFilters
)

router = APIRouter()

# ============================================
# GET ANNOUNCEMENTS (with filters)
# ============================================

@router.get("/", response_model=AnnouncementListResponse)
async def get_announcements(
    current_user: User = Depends(get_current_user),
    type: Optional[str] = None,
    priority: Optional[str] = None,
    is_published: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get all announcements with filters"""
    service = AnnouncementService(db)
    
    # Get announcements based on user role
    announcements = await service.get_announcements(str(current_user.id))
    
    # Apply filters
    if type:
        announcements = [a for a in announcements if a.type == type]
    if priority:
        announcements = [a for a in announcements if a.priority == priority]
    if is_published is not None:
        announcements = [a for a in announcements if a.is_published == is_published]
    if search:
        search_lower = search.lower()
        announcements = [
            a for a in announcements 
            if search_lower in a.title.lower() or search_lower in a.content.lower()
        ]
    
    # Pagination
    total = len(announcements)
    announcements = announcements[skip:skip + limit]
    
    return {
        "total": total,
        "items": announcements
    }

# ============================================
# GET ANNOUNCEMENT BY ID
# ============================================

@router.get("/{announcement_id}", response_model=AnnouncementResponse)
async def get_announcement(
    announcement_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a single announcement by ID"""
    service = AnnouncementService(db)
    return await service.get_announcement(announcement_id)

# ============================================
# CREATE ANNOUNCEMENT
# ============================================

@router.post("/", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    data: AnnouncementCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new announcement (Professors and Admins only)"""
    service = AnnouncementService(db)
    return await service.create_announcement(str(current_user.id), data)

# ============================================
# UPDATE ANNOUNCEMENT
# ============================================

@router.put("/{announcement_id}", response_model=AnnouncementResponse)
async def update_announcement(
    announcement_id: str,
    data: AnnouncementUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an announcement"""
    service = AnnouncementService(db)
    return await service.update_announcement(
        announcement_id, 
        str(current_user.id), 
        data
    )

# ============================================
# DELETE ANNOUNCEMENT
# ============================================

@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    announcement_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an announcement"""
    service = AnnouncementService(db)
    await service.delete_announcement(announcement_id, str(current_user.id))
    return None

# ============================================
# TOGGLE PUBLISH STATUS
# ============================================

@router.patch("/{announcement_id}/publish")
async def toggle_publish(
    announcement_id: str,
    is_published: bool,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle publish status of an announcement"""
    service = AnnouncementService(db)
    return await service.toggle_publish_status(
        announcement_id, 
        str(current_user.id), 
        is_published
    )