# backend/app/api/v1/endpoints/meethub.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.models.meethub import MeethubSession, MeethubSpeakRequest, MeethubAttendanceRecord
from app.services.meethub_service import MeethubService
from app.schemas.meethub import (
    MeethubSessionCreate, MeethubSessionResponse,
    SpeakRequestResponse, AttendanceRecordResponse, AttendanceRosterEntry, AttendanceUpsert,
)

router = APIRouter()


def _serialize_session(session: MeethubSession, current_user_id: str) -> dict:
    stream = session.livestream
    organizer = stream.host
    return {
        "id": str(session.id),
        "livestream_id": str(session.livestream_id),
        "organizer_id": str(session.organizer_id),
        "organizer_username": organizer.username,
        "organizer_role": organizer.role,
        "teaching_assignment_id": str(session.teaching_assignment_id) if session.teaching_assignment_id else None,
        "is_official": session.teaching_assignment_id is not None,
        "title": stream.title,
        "description": stream.description,
        "visibility": stream.visibility,
        "target_section_ids": stream.target_section_ids,
        "thumbnail_url": stream.thumbnail_url,
        "status": stream.status,
        "viewer_count": stream.viewer_count,
        "allow_participant_camera": session.allow_participant_camera,
        "allow_participant_mic": session.allow_participant_mic,
        "entry_start": session.entry_start,
        "entry_deadline": session.entry_deadline,
        "started_at": stream.started_at,
        "ended_at": stream.ended_at,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "is_organizer": str(session.organizer_id) == current_user_id,
    }


async def _serialize_session_with_avatar(session: MeethubSession, current_user_id: str, service: MeethubService) -> dict:
    payload = _serialize_session(session, current_user_id)
    organizer = session.livestream.host
    payload["organizer_avatar"] = await service.livestream_service._get_avatar_url(str(organizer.id), organizer.role)
    return payload


def _serialize_speak_request(req: MeethubSpeakRequest, avatar: Optional[str] = None) -> dict:
    return {
        "id": str(req.id),
        "meethub_session_id": str(req.meethub_session_id),
        "user_id": str(req.user_id),
        "username": req.user.username,
        "avatar": avatar,
        "status": req.status,
        "requested_at": req.requested_at,
        "resolved_at": req.resolved_at,
    }


def _serialize_attendance(record: MeethubAttendanceRecord, avatar: Optional[str] = None) -> dict:
    return {
        "user_id": str(record.user_id),
        "username": record.user.username,
        "avatar": avatar,
        "status": record.status,
        "first_joined_at": record.first_joined_at,
        "marked_at": record.marked_at,
        "notes": record.notes,
    }


@router.post("/sessions", response_model=MeethubSessionResponse, status_code=201)
async def create_meethub_session(
    data: MeethubSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Meethub session - creates a plain Livestream underneath via
    LivestreamService.create_stream, unchanged, then decorates it."""
    service = MeethubService(db)
    session = await service.create_session(str(current_user.id), data)
    return await _serialize_session_with_avatar(session, str(current_user.id), service)


@router.get("/sessions", response_model=List[MeethubSessionResponse])
async def list_my_meethub_sessions(
    status: Optional[str] = Query(None, description="Filter by status: scheduled, live, ended"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = MeethubService(db)
    sessions = await service.get_my_sessions(str(current_user.id), status)
    return [await _serialize_session_with_avatar(s, str(current_user.id), service) for s in sessions]


@router.get("/sessions/by-stream/{livestream_id}", response_model=MeethubSessionResponse)
async def get_meethub_session_by_stream(
    livestream_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Looked up by the frontend's existing /live/:streamId page, which only
    knows the underlying livestream id - lets the same LiveStreamStage
    render Meethub-only panels without needing a second route."""
    service = MeethubService(db)
    session = await service.get_session_by_livestream_id(livestream_id, str(current_user.id))
    return await _serialize_session_with_avatar(session, str(current_user.id), service)


@router.get("/sessions/{session_id}", response_model=MeethubSessionResponse)
async def get_meethub_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = MeethubService(db)
    session = await service.get_session_detail(session_id, str(current_user.id))
    return await _serialize_session_with_avatar(session, str(current_user.id), service)


@router.post("/sessions/{session_id}/speak-requests", response_model=SpeakRequestResponse, status_code=201)
async def request_to_speak(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = MeethubService(db)
    req = await service.request_to_speak(session_id, str(current_user.id))
    avatar = await service.livestream_service._get_avatar_url(str(current_user.id), current_user.role)

    from app.websocket.manager import manager, _stream_room
    session = await service.get_session_detail(session_id, str(current_user.id))
    await manager.send_to_room(
        _stream_room(str(session.livestream_id)),
        "meeting:speak_requested",
        {"session_id": session_id, "user_id": str(current_user.id), "username": current_user.username, "request_id": str(req.id)},
    )

    return _serialize_speak_request(req, avatar)


@router.delete("/sessions/{session_id}/speak-requests/me")
async def cancel_my_speak_request(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = MeethubService(db)
    return await service.cancel_my_speak_request(session_id, str(current_user.id))


@router.get("/sessions/{session_id}/speak-requests", response_model=List[SpeakRequestResponse])
async def list_speak_requests(
    session_id: str,
    status: Optional[str] = Query("pending"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = MeethubService(db)
    requests = await service.list_speak_requests(session_id, str(current_user.id), status)
    return [
        _serialize_speak_request(r, await service.livestream_service._get_avatar_url(str(r.user_id), r.user.role))
        for r in requests
    ]


async def _resolve_and_broadcast(session_id: str, request_id: str, current_user: User, db: AsyncSession, approve: bool):
    """Approving/denying a raised hand is a pure notification - it never
    touches anyone's camera/mic, so the only broadcast needed is telling the
    room the request was resolved (the requester sees their own hand-raise
    acknowledged; everyone else's participant list updates)."""
    service = MeethubService(db)
    req = await service.resolve_speak_request(session_id, request_id, str(current_user.id), approve)

    from app.websocket.manager import manager, _stream_room
    session = await service.get_session_detail(session_id, str(current_user.id))
    await manager.send_to_room(
        _stream_room(str(session.livestream_id)),
        "meeting:speak_request_resolved",
        {"session_id": session_id, "request_id": request_id, "status": req.status},
    )
    avatar = await service.livestream_service._get_avatar_url(str(req.user_id), req.user.role)
    return _serialize_speak_request(req, avatar)


@router.post("/sessions/{session_id}/speak-requests/{request_id}/approve", response_model=SpeakRequestResponse)
async def approve_speak_request(
    session_id: str,
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _resolve_and_broadcast(session_id, request_id, current_user, db, approve=True)


@router.post("/sessions/{session_id}/speak-requests/{request_id}/deny", response_model=SpeakRequestResponse)
async def deny_speak_request(
    session_id: str,
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _resolve_and_broadcast(session_id, request_id, current_user, db, approve=False)


@router.get("/sessions/{session_id}/attendance", response_model=List[AttendanceRosterEntry])
async def get_attendance(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = MeethubService(db)
    return await service.get_roster(session_id, str(current_user.id))


@router.get("/sessions/{session_id}/attendance/me", response_model=Optional[AttendanceRecordResponse])
async def get_my_attendance(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = MeethubService(db)
    record = await service.get_my_attendance(session_id, str(current_user.id))
    if not record:
        return None
    return _serialize_attendance(record, await service.livestream_service._get_avatar_url(str(record.user_id), current_user.role))


@router.put("/sessions/{session_id}/attendance", response_model=AttendanceRecordResponse)
async def mark_attendance(
    session_id: str,
    data: AttendanceUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = MeethubService(db)
    record = await service.mark_attendance(session_id, str(current_user.id), data)

    from app.websocket.manager import manager, _stream_room
    session = await service.get_session_detail(session_id, str(current_user.id))
    await manager.send_to_room(
        _stream_room(str(session.livestream_id)),
        "meeting:attendance_updated",
        {"session_id": session_id, "user_id": str(record.user_id), "status": record.status},
    )

    avatar = await service.livestream_service._get_avatar_url(str(record.user_id), record.user.role)
    return _serialize_attendance(record, avatar)
