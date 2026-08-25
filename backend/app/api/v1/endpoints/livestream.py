# backend/app/api/v1/endpoints/livestream.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services.livestream_service import LivestreamService
from app.services.stream_comment_service import StreamCommentService
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
        "host_avatar": await service._get_avatar_url(str(current_user.id), current_user.role),
        "host_role": current_user.role,
        "title": stream.title,
        "description": stream.description,
        "visibility": stream.visibility,
        "target_section_ids": stream.target_section_ids,
        "thumbnail_url": stream.thumbnail_url,
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
        "host_avatar": await service._get_avatar_url(str(s.host_id), s.host.role),
        "host_role": s.host.role,
        "title": s.title,
        "description": s.description,
        "visibility": s.visibility,
        "target_section_ids": s.target_section_ids,
        "thumbnail_url": s.thumbnail_url,
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
        "host_avatar": await service._get_avatar_url(str(stream.host_id), stream.host.role),
        "host_role": stream.host.role,
        "title": stream.title,
        "description": stream.description,
        "visibility": stream.visibility,
        "target_section_ids": stream.target_section_ids,
        "thumbnail_url": stream.thumbnail_url,
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
        "host_avatar": await service._get_avatar_url(str(stream.host_id), stream.host.role),
        "host_role": stream.host.role,
        "title": stream.title,
        "description": stream.description,
        "visibility": stream.visibility,
        "target_section_ids": stream.target_section_ids,
        "thumbnail_url": stream.thumbnail_url,
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

    payload = {
        "id": str(stream.id),
        "host_id": str(stream.host_id),
        "host_username": stream.host.username,
        "host_avatar": await service._get_avatar_url(str(stream.host_id), stream.host.role),
        "host_role": stream.host.role,
        "title": stream.title,
        "description": stream.description,
        "visibility": stream.visibility,
        "target_section_ids": stream.target_section_ids,
        "thumbnail_url": stream.thumbnail_url,
        "status": stream.status,
        "viewer_count": stream.viewer_count,
        "started_at": stream.started_at.isoformat() if stream.started_at else None,
        "ended_at": stream.ended_at.isoformat() if stream.ended_at else None,
        "created_at": stream.created_at.isoformat() if stream.created_at else None,
        "updated_at": stream.updated_at.isoformat() if stream.updated_at else None,
    }

    # Broadcast to every connected user who is actually allowed to view this
    # stream, not just whoever has already joined its room (nobody has yet,
    # at start time) - reuses the exact same can_view_stream check the REST
    # list/detail endpoints already enforce, so a Dashboard's realtime feed
    # respects public/friends/section visibility identically to its initial
    # page-load fetch instead of leaking every stream to every connection.
    from app.websocket.manager import manager

    recipient_user_ids = {conn['user_id'] for conn in manager.active_connections.values()}
    for uid in recipient_user_ids:
        if await service.can_view_stream(uid, stream_id):
            await manager.send_to_user(uid, 'stream:started', payload)

    return {**payload, "is_host": True, "can_view": True}

@router.post("/{stream_id}/end", response_model=LivestreamResponse)
async def end_stream(
    stream_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """End a livestream"""
    service = LivestreamService(db)
    stream = await service.end_stream(stream_id, str(current_user.id))

    # Ending via REST doesn't itself disconnect the host's Socket.IO
    # connection - it's a single connection shared by the whole app, so it
    # stays open after navigating away. Without this, viewers would only
    # ever find out the stream ended by fully closing/logging out, so
    # broadcast it immediately and clear the in-memory host/viewer tracking.
    from app.websocket.manager import manager, sio

    await sio.emit('stream:host_left', {'stream_id': stream_id}, room=f"stream_{stream_id}")
    manager.stream_hosts.pop(stream_id, None)
    manager.stream_viewers.pop(stream_id, None)

    # Separate, no-room broadcast (everyone connected, not just this stream's
    # room) so a dashboard that never opened this stream still removes its
    # card immediately instead of waiting on the next poll/refetch.
    await sio.emit('stream:ended', {'stream_id': stream_id})

    return {
        "id": str(stream.id),
        "host_id": str(stream.host_id),
        "host_username": stream.host.username,
        "host_avatar": await service._get_avatar_url(str(stream.host_id), stream.host.role),
        "host_role": stream.host.role,
        "title": stream.title,
        "description": stream.description,
        "visibility": stream.visibility,
        "target_section_ids": stream.target_section_ids,
        "thumbnail_url": stream.thumbnail_url,
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
        "avatar": await service._get_avatar_url(str(v.user_id), v.user.role),
        "joined_at": v.joined_at
    } for v in viewers]

@router.get("/{stream_id}/comments")
async def get_comments(
    stream_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Chat history for a stream - the database is the source of truth for
    persistence; the live chat socket handlers (stream:chat_message etc.) are
    the source of truth for realtime delivery only. Called on mount/refresh
    so a viewer's chat panel isn't empty just because they weren't connected
    when earlier messages were sent. Same visibility rule as watching the
    stream itself (enforced in StreamCommentService)."""
    service = StreamCommentService(db)
    return await service.get_comments(stream_id, str(current_user.id))