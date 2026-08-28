# backend/app/api/v1/endpoints/teaching_assignments.py
# Mounted at a prefix separate from /sections so "mine" can never collide
# with a /sections/{section_id}-style path param lookup.
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services.teaching_assignment_service import TeachingAssignmentService
from app.schemas.section import TeachingAssignmentUpdate, TeachingAssignmentResponse, TeachingAssignmentAttendanceEntry
from typing import List

router = APIRouter()

@router.get("/mine", response_model=List[TeachingAssignmentResponse])
async def get_my_teaching_assignments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """The current professor's teaching assignments across all sections"""
    service = TeachingAssignmentService(db)
    return await service.list_mine(str(current_user.id))

@router.get("/{assignment_id}/attendance", response_model=List[TeachingAssignmentAttendanceEntry])
async def get_teaching_assignment_attendance(
    assignment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Persisted attendance across every official Meethub session ever held
    for this teaching assignment - owner professor or admin only."""
    service = TeachingAssignmentService(db)
    return await service.get_attendance(assignment_id, current_user)

@router.put("/{assignment_id}", response_model=TeachingAssignmentResponse)
async def update_teaching_assignment(
    assignment_id: str,
    data: TeachingAssignmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Edit subject/schedule/status - owner professor or admin only"""
    service = TeachingAssignmentService(db)
    return await service.update_assignment(assignment_id, data, current_user)

@router.delete("/{assignment_id}")
async def delete_teaching_assignment(
    assignment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a teaching assignment - owner professor or admin only. Never
    deletes the section, its students, mayor, officer, or other professors."""
    service = TeachingAssignmentService(db)
    return await service.delete_assignment(assignment_id, current_user)
