# backend/app/api/v1/endpoints/livestream.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services.livestream_service import LivestreamService
from app.schemas.livestream import (
    LivestreamCreate, LivestreamUpdate, LivestreamResponse,
    StreamViewerResponse, StreamViewerCount, StreamChatMessage
)

router = APIRouter()

@router.post("/", response_model=LivestreamResponse, status_code=status.HTTP_201_CREATED)
async def create_stream(
    data: LivestreamCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new livestream"""
    service = LivestreamService(db)
    stream = await service.create_stream(str(current_user.id), data)
    
    return {
        "id": str(stream.id),
        "host_id": str(stream.host_id),
        "host_username": current_user.username,
        "host_role": current_user.role,
        "title": stream.title,
        "description": stream.description,
        "visibility": stream.visibility,
        "target_section_ids": stream.target_section_ids,
        "status": stream.status,
        "viewer_count": 0,
        "stream_key": stream.stream_key,
        "started_at": stream.started_at,
        "ended_at": stream.ended_at,
        "created_at": stream.created_at,
        "updated_at": stream.updated_at,
        "is_host": True,
        "can_view": True
    }

@router.get("/", response_model=List[LivestreamResponse])
async def get_streams(
    status: Optional[str] = Query(None, description="Filter by status: scheduled, live, ended"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all streams the user can view"""
    service = LivestreamService(db)
    streams = await service.get_streams(str(current_user.id), status)
    
    return [{
        "id": str(s.id),
        "host_id": str(s.host_id),
        "host_username": s.host.username,
        "host_avatar": None,
        "host_role": s.host.role,
        "title": s.title,
        "description": s.description,
        "visibility": s.visibility,
        "target_section_ids": s.target_section_ids,
        "status": s.status,
        "viewer_count": s.viewer_count,
        "started_at": s.started_at,
        "ended_at": s.ended_at,
        "created_at": s.created_at,
        "updated_at": s.updated_at,
        "is_host": str(s.host_id) == str(current_user.id),
        "can_view": True
    } for s in streams]

@router.get("/{stream_id}", response_model=LivestreamResponse)
async def get_stream(
    stream_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific stream"""
    service = LivestreamService(db)
    stream = await service.get_stream(stream_id, str(current_user.id))
    
    return {
        "id": str(stream.id),
        "host_id": str(stream.host_id),
        "host_username": stream.host.username,
        "host_avatar": None,
        "host_role": stream.host.role,
        "title": stream.title,
        "description": stream.description,
        "visibility": stream.visibility,
        "target_section_ids": stream.target_section_ids,
        "status": stream.status,
        "viewer_count": stream.viewer_count,
        "started_at": stream.started_at,
        "ended_at": stream.ended_at,
        "created_at": stream.created_at,
        "updated_at": stream.updated_at,
        "is_host": str(stream.host_id) == str(current_user.id),
        "can_view": True
    }

@router.put("/{stream_id}", response_model=LivestreamResponse)
async def update_stream(
    stream_id: str,
    data: LivestreamUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a stream"""
    service = LivestreamService(db)
    stream = await service.update_stream(stream_id, str(current_user.id), data)
    
    return {
        "id": str(stream.id),
        "host_id": str(stream.host_id),
        "host_username": stream.host.username,
        "host_role": stream.host.role,
        "title": stream.title,
        "description": stream.description,
        "visibility": stream.visibility,
        "target_section_ids": stream.target_section_ids,
        "status": stream.status,
        "viewer_count": stream.viewer_count,
        "started_at": stream.started_at,
        "ended_at": stream.ended_at,
        "created_at": stream.created_at,
        "updated_at": stream.updated_at,
        "is_host": str(stream.host_id) == str(current_user.id),
        "can_view": True
    }

@router.post("/{stream_id}/start", response_model=LivestreamResponse)
async def start_stream(
    stream_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Start a livestream"""
    service = LivestreamService(db)
    stream = await service.start_stream(stream_id, str(current_user.id))
    
    return {
        "id": str(stream.id),
        "host_id": str(stream.host_id),
        "host_username": stream.host.username,
        "host_role": stream.host.role,
        "title": stream.title,
        "description": stream.description,
        "visibility": stream.visibility,
        "target_section_ids": stream.target_section_ids,
        "status": stream.status,
        "viewer_count": stream.viewer_count,
        "started_at": stream.started_at,
        "ended_at": stream.ended_at,
        "created_at": stream.created_at,
        "updated_at": stream.updated_at,
        "is_host": True,
        "can_view": True
    }

@router.post("/{stream_id}/end", response_model=LivestreamResponse)
async def end_stream(
    stream_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """End a livestream"""
    service = LivestreamService(db)
    stream = await service.end_stream(stream_id, str(current_user.id))
    
    return {
        "id": str(stream.id),
        "host_id": str(stream.host_id),
        "host_username": stream.host.username,
        "host_role": stream.host.role,
        "title": stream.title,
        "description": stream.description,
        "visibility": stream.visibility,
        "target_section_ids": stream.target_section_ids,
        "status": stream.status,
        "viewer_count": stream.viewer_count,
        "started_at": stream.started_at,
        "ended_at": stream.ended_at,
        "created_at": stream.created_at,
        "updated_at": stream.updated_at,
        "is_host": True,
        "can_view": True
    }

@router.post("/{stream_id}/join")
async def join_stream(
    stream_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Join a livestream as a viewer"""
    service = LivestreamService(db)
    return await service.add_viewer(stream_id, str(current_user.id))

@router.post("/{stream_id}/leave")
async def leave_stream(
    stream_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Leave a livestream"""
    service = LivestreamService(db)
    return await service.remove_viewer(stream_id, str(current_user.id))

@router.get("/{stream_id}/viewers", response_model=List[StreamViewerResponse])
async def get_viewers(
    stream_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get active viewers of a stream"""
    service = LivestreamService(db)
    viewers = await service.get_viewers(stream_id, str(current_user.id))
    
    return [{
        "id": str(v.id),
        "user_id": str(v.user_id),
        "username": v.user.username,
        "avatar": None,
        "joined_at": v.joined_at
    } for v in viewers]