# backend/app/models/meethub.py
from sqlalchemy import Column, String, Text, ForeignKey, Boolean, Index
from app.core.db_types import UTCDateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from datetime import datetime


class MeethubSession(Base):
    """Decorates a Livestream with academic-meeting fields, mirroring how
    TeachingAssignmentConversation decorates a TeachingAssignment - the
    underlying Livestream row still owns start/end/visibility/host_id and is
    the thing the existing WebRTC/chat/viewer code operates on unmodified.

    host_id on the linked Livestream never changes; current_speaker_id here
    is the only mutable "who is currently broadcasting" field, flipped on
    speak-request approval/reclaim/disconnect. teaching_assignment_id is
    NULL for a student-created (unofficial) session - that absence is what
    makes such a session structurally unable to ever record attendance.
    """
    __tablename__ = "meethub_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    livestream_id = Column(
        UUID(as_uuid=True), ForeignKey("livestreams.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    teaching_assignment_id = Column(
        UUID(as_uuid=True), ForeignKey("teaching_assignments.id", ondelete="SET NULL"), nullable=True
    )
    organizer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    current_speaker_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    allow_participant_camera = Column(Boolean, default=True)
    allow_participant_mic = Column(Boolean, default=True)
    entry_start = Column(UTCDateTime, nullable=True)
    entry_deadline = Column(UTCDateTime, nullable=True)
    created_at = Column(UTCDateTime, default=datetime.utcnow)
    updated_at = Column(UTCDateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    livestream = relationship("Livestream")
    teaching_assignment = relationship("TeachingAssignment")
    organizer = relationship("User", foreign_keys=[organizer_id])
    current_speaker = relationship("User", foreign_keys=[current_speaker_id])
    speak_requests = relationship("MeethubSpeakRequest", back_populates="session", cascade="all, delete-orphan")
    attendance_records = relationship("MeethubAttendanceRecord", back_populates="session", cascade="all, delete-orphan")


class MeethubSpeakRequest(Base):
    """One row per raised hand. Only one 'pending' row per (session, user)
    can exist at a time, enforced by the partial unique index below - the
    same pattern as StreamViewer's active-viewer uniqueness, with the same
    IntegrityError-catch race handling in the service layer."""
    __tablename__ = "meethub_speak_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meethub_session_id = Column(UUID(as_uuid=True), ForeignKey("meethub_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="pending")  # pending | approved | denied | cancelled | completed
    requested_at = Column(UTCDateTime, default=datetime.utcnow)
    resolved_at = Column(UTCDateTime, nullable=True)
    resolved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    session = relationship("MeethubSession", back_populates="speak_requests")
    user = relationship("User", foreign_keys=[user_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])


class MeethubAttendanceRecord(Base):
    """The final attendance verdict for one user in one session - upserted
    in place (unique per session+user), not appended as a log. Only ever
    written when the session's teaching_assignment_id is set; enforced in
    the service, not here, since the FK alone can't express "only when
    another column is non-null"."""
    __tablename__ = "meethub_attendance_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meethub_session_id = Column(UUID(as_uuid=True), ForeignKey("meethub_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="absent")  # present | late | excused | absent
    first_joined_at = Column(UTCDateTime, nullable=True)
    marked_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    marked_at = Column(UTCDateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(UTCDateTime, default=datetime.utcnow)
    updated_at = Column(UTCDateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    session = relationship("MeethubSession", back_populates="attendance_records")
    user = relationship("User", foreign_keys=[user_id])
    marked_by = relationship("User", foreign_keys=[marked_by_id])


Index(
    "uq_meethub_speak_requests_pending",
    MeethubSpeakRequest.meethub_session_id,
    MeethubSpeakRequest.user_id,
    unique=True,
    postgresql_where=MeethubSpeakRequest.status == "pending",
)

Index(
    "uq_meethub_attendance_session_user",
    MeethubAttendanceRecord.meethub_session_id,
    MeethubAttendanceRecord.user_id,
    unique=True,
)
