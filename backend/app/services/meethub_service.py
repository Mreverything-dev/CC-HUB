# backend/app/services/meethub_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from typing import List, Optional
from datetime import datetime

from app.models.livestream import Livestream, StreamStatus, StreamViewer
from app.models.meethub import MeethubSession, MeethubSpeakRequest, MeethubAttendanceRecord
from app.models.teaching_assignment import TeachingAssignment
from app.models.section import SectionMember
from app.schemas.livestream import LivestreamCreate
from app.schemas.meethub import MeethubSessionCreate, AttendanceUpsert
from app.services.livestream_service import LivestreamService
from app.services.section_service import SectionService


class MeethubService:
    """Academic live meetings, built entirely on top of LivestreamService -
    every session here IS a Livestream row underneath, so start/end/join/
    leave/viewers/chat all go through the existing, unmodified livestream
    endpoints and WebRTC signaling. This service only adds the
    Meethub-specific facts a plain livestream doesn't have: who organized
    it, who is the official teaching assignment (if any), who currently
    holds the mic, speak requests, and attendance."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.livestream_service = LivestreamService(db)

    def _require_organizer(self, session: MeethubSession, user_id: str):
        if str(session.organizer_id) != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the meeting organizer can do this",
            )

    async def create_session(self, user_id: str, data: MeethubSessionCreate) -> MeethubSession:
        if data.teaching_assignment_id:
            result = await self.db.execute(
                select(TeachingAssignment).where(
                    TeachingAssignment.id == data.teaching_assignment_id,
                    TeachingAssignment.professor_id == user_id,
                    TeachingAssignment.status == "active",
                )
            )
            if not result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have an active teaching assignment matching this id",
                )

        stream = await self.livestream_service.create_stream(
            user_id,
            LivestreamCreate(
                title=data.title,
                description=data.description,
                visibility=data.visibility,
                target_section_ids=data.target_section_ids,
                thumbnail_url=data.thumbnail_url,
            ),
        )

        session = MeethubSession(
            livestream_id=stream.id,
            teaching_assignment_id=data.teaching_assignment_id,
            organizer_id=user_id,
            allow_participant_camera=data.allow_participant_camera,
            allow_participant_mic=data.allow_participant_mic,
            entry_start=data.entry_start,
            entry_deadline=data.entry_deadline,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return await self._get_session(str(session.id))

    async def _get_session(self, session_id: str) -> MeethubSession:
        result = await self.db.execute(
            select(MeethubSession)
            .options(selectinload(MeethubSession.livestream).selectinload(Livestream.host))
            .where(MeethubSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meethub session not found")
        return session

    async def get_session_detail(self, session_id: str, user_id: str) -> MeethubSession:
        session = await self._get_session(session_id)
        # Reuses LivestreamService.get_stream unchanged for the 404/403
        # visibility check - a Meethub session is only ever viewable by
        # whoever could already view its underlying livestream.
        await self.livestream_service.get_stream(str(session.livestream_id), user_id)
        return session

    async def get_session_by_livestream_id(self, livestream_id: str, user_id: str) -> MeethubSession:
        await self.livestream_service.get_stream(livestream_id, user_id)
        result = await self.db.execute(
            select(MeethubSession)
            .options(selectinload(MeethubSession.livestream).selectinload(Livestream.host))
            .where(MeethubSession.livestream_id == livestream_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This livestream is not a Meethub session")
        return session

    async def get_my_sessions(self, user_id: str, status_filter: Optional[str] = None) -> List[MeethubSession]:
        # Reuses LivestreamService.get_streams unchanged for visibility
        # filtering, then attaches the Meethub-specific rows for whichever
        # of those streams are actually Meethub sessions.
        streams = await self.livestream_service.get_streams(user_id, status_filter)
        stream_ids = [s.id for s in streams]
        if not stream_ids:
            return []
        result = await self.db.execute(
            select(MeethubSession)
            .options(selectinload(MeethubSession.livestream).selectinload(Livestream.host))
            .where(MeethubSession.livestream_id.in_(stream_ids))
        )
        return result.scalars().all()

    async def request_to_speak(self, session_id: str, user_id: str) -> MeethubSpeakRequest:
        session = await self.get_session_detail(session_id, user_id)
        if str(session.organizer_id) == user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The organizer doesn't need to request to speak")

        # Captured as a plain value before the try block - rollback() expires
        # every ORM object already loaded in this session (session included),
        # and touching an expired attribute afterward (even .id) triggers an
        # unsupported synchronous lazy-refresh under an async session,
        # crashing with MissingGreenlet. LivestreamService.add_viewer's
        # existing recovery query avoids this the same way, by only ever
        # using its plain string parameters, never a loaded ORM attribute.
        meethub_session_id = session.id

        try:
            req = MeethubSpeakRequest(meethub_session_id=meethub_session_id, user_id=user_id)
            self.db.add(req)
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            # A duplicate request (double-click, retry) races the partial
            # unique index - treat the existing pending row as success,
            # mirroring LivestreamService.add_viewer's recovery pattern.
            result = await self.db.execute(
                select(MeethubSpeakRequest)
                .options(selectinload(MeethubSpeakRequest.user))
                .where(
                    MeethubSpeakRequest.meethub_session_id == meethub_session_id,
                    MeethubSpeakRequest.user_id == user_id,
                    MeethubSpeakRequest.status == "pending",
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                return existing
            raise
        result = await self.db.execute(
            select(MeethubSpeakRequest)
            .options(selectinload(MeethubSpeakRequest.user))
            .where(MeethubSpeakRequest.id == req.id)
        )
        return result.scalar_one()

    async def cancel_my_speak_request(self, session_id: str, user_id: str) -> dict:
        session = await self.get_session_detail(session_id, user_id)
        result = await self.db.execute(
            select(MeethubSpeakRequest).where(
                MeethubSpeakRequest.meethub_session_id == session.id,
                MeethubSpeakRequest.user_id == user_id,
                MeethubSpeakRequest.status == "pending",
            )
        )
        req = result.scalar_one_or_none()
        if req:
            req.status = "cancelled"
            req.resolved_at = datetime.utcnow()
            await self.db.commit()
        return {"cancelled": True}

    async def list_speak_requests(
        self, session_id: str, user_id: str, status_filter: Optional[str] = "pending"
    ) -> List[MeethubSpeakRequest]:
        session = await self.get_session_detail(session_id, user_id)
        self._require_organizer(session, user_id)

        query = (
            select(MeethubSpeakRequest)
            .options(selectinload(MeethubSpeakRequest.user))
            .where(MeethubSpeakRequest.meethub_session_id == session.id)
        )
        if status_filter:
            query = query.where(MeethubSpeakRequest.status == status_filter)
        query = query.order_by(MeethubSpeakRequest.requested_at.asc())
        result = await self.db.execute(query)
        return result.scalars().all()

    async def resolve_speak_request(
        self, session_id: str, request_id: str, user_id: str, approve: bool
    ) -> MeethubSpeakRequest:
        """Approve/deny is a pure classroom notification - every participant
        controls their own camera/mic independently (see the mesh signaling
        layer), so resolving a raised hand has no effect on anyone's media."""
        session = await self.get_session_detail(session_id, user_id)
        self._require_organizer(session, user_id)

        result = await self.db.execute(
            select(MeethubSpeakRequest).where(
                MeethubSpeakRequest.id == request_id,
                MeethubSpeakRequest.meethub_session_id == session.id,
            )
        )
        req = result.scalar_one_or_none()
        if not req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Speak request not found")
        if req.status != "pending":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This request has already been resolved")

        req.status = "approved" if approve else "denied"
        req.resolved_at = datetime.utcnow()
        req.resolved_by_id = user_id

        await self.db.commit()
        result = await self.db.execute(
            select(MeethubSpeakRequest)
            .options(selectinload(MeethubSpeakRequest.user))
            .where(MeethubSpeakRequest.id == req.id)
        )
        return result.scalar_one()

    async def mark_attendance(self, session_id: str, user_id: str, data: AttendanceUpsert) -> MeethubAttendanceRecord:
        session = await self.get_session_detail(session_id, user_id)
        if not session.teaching_assignment_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This is not an official class session - attendance cannot be recorded",
            )
        self._require_organizer(session, user_id)

        # Defensive: attendance should only ever apply to someone who
        # actually belongs to this class's section.
        ta_result = await self.db.execute(
            select(TeachingAssignment).where(TeachingAssignment.id == session.teaching_assignment_id)
        )
        ta = ta_result.scalar_one_or_none()
        if not ta:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This class's teaching assignment could not be found",
            )
        member_result = await self.db.execute(
            select(SectionMember).where(
                SectionMember.section_id == ta.section_id,
                SectionMember.user_id == data.user_id,
                SectionMember.role == "student",
            )
        )
        if not member_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This user is not a student member of this class's section",
            )

        meethub_session_id = session.id  # captured before any possible rollback - see request_to_speak

        result = await self.db.execute(
            select(MeethubAttendanceRecord).where(
                MeethubAttendanceRecord.meethub_session_id == meethub_session_id,
                MeethubAttendanceRecord.user_id == data.user_id,
            )
        )
        record = result.scalar_one_or_none()
        if not record:
            record = MeethubAttendanceRecord(meethub_session_id=meethub_session_id, user_id=data.user_id)
            self.db.add(record)

        record.status = data.status
        record.notes = data.notes
        record.marked_by_id = user_id
        record.marked_at = datetime.utcnow()

        try:
            await self.db.commit()
        except IntegrityError:
            # Two simultaneous marks for the same student raced the unique
            # index - re-apply this call's status against whichever row won,
            # rather than silently dropping the organizer's action.
            await self.db.rollback()
            result = await self.db.execute(
                select(MeethubAttendanceRecord).where(
                    MeethubAttendanceRecord.meethub_session_id == meethub_session_id,
                    MeethubAttendanceRecord.user_id == data.user_id,
                )
            )
            record = result.scalar_one()
            record.status = data.status
            record.notes = data.notes
            record.marked_by_id = user_id
            record.marked_at = datetime.utcnow()
            await self.db.commit()

        record_id = record.id
        result = await self.db.execute(
            select(MeethubAttendanceRecord)
            .options(selectinload(MeethubAttendanceRecord.user))
            .where(MeethubAttendanceRecord.id == record_id)
        )
        return result.scalar_one()

    async def get_roster(self, session_id: str, user_id: str) -> List[dict]:
        """Attendance roster for the whole class section, not just who has
        joined so far - any authorized viewer (not just the organizer) can
        read this; only mark_attendance is organizer-gated."""
        session = await self.get_session_detail(session_id, user_id)
        if not session.teaching_assignment_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This is not an official class session")

        ta_result = await self.db.execute(
            select(TeachingAssignment).where(TeachingAssignment.id == session.teaching_assignment_id)
        )
        ta = ta_result.scalar_one_or_none()
        if not ta:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teaching assignment not found")

        section_data = await SectionService(self.db).get_section(str(ta.section_id), user_id)
        students = [m for m in section_data["members"] if m["role"] == "student"]

        records_result = await self.db.execute(
            select(MeethubAttendanceRecord).where(MeethubAttendanceRecord.meethub_session_id == session.id)
        )
        records_by_user = {str(r.user_id): r for r in records_result.scalars().all()}

        online_result = await self.db.execute(
            select(StreamViewer.user_id).where(
                StreamViewer.stream_id == session.livestream_id,
                StreamViewer.is_active == True,
            )
        )
        online_user_ids = {str(uid) for uid in online_result.scalars().all()}

        roster = []
        for member in students:
            record = records_by_user.get(member["user_id"])
            roster.append({
                "user_id": member["user_id"],
                "username": member["user_username"],
                "avatar": member["user_avatar"],
                "first_name": member["user_first_name"],
                "last_name": member["user_last_name"],
                "role": member["role"],
                "is_officer": member["is_officer"],
                "is_mayor": member["is_mayor"],
                "is_online": member["user_id"] in online_user_ids,
                "status": record.status if record else None,
                "first_joined_at": record.first_joined_at if record else None,
                "marked_at": record.marked_at if record else None,
                "notes": record.notes if record else None,
            })
        return roster

    async def get_my_attendance(self, session_id: str, user_id: str) -> Optional[MeethubAttendanceRecord]:
        session = await self.get_session_detail(session_id, user_id)
        result = await self.db.execute(
            select(MeethubAttendanceRecord).where(
                MeethubAttendanceRecord.meethub_session_id == session.id,
                MeethubAttendanceRecord.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()
