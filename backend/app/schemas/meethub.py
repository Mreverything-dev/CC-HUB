# backend/app/schemas/meethub.py
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime

from app.schemas.livestream import StreamVisibility, StreamStatus


class MeethubSessionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    visibility: StreamVisibility = StreamVisibility.SECTION
    target_section_ids: List[str] = Field(default_factory=list)
    thumbnail_url: Optional[str] = Field(None, max_length=500)
    teaching_assignment_id: Optional[str] = None
    allow_participant_camera: bool = True
    allow_participant_mic: bool = True
    entry_start: Optional[datetime] = None
    entry_deadline: Optional[datetime] = None


class MeethubSessionResponse(BaseModel):
    id: str
    livestream_id: str
    organizer_id: str
    organizer_username: str
    organizer_avatar: Optional[str] = None
    organizer_role: str
    teaching_assignment_id: Optional[str] = None
    is_official: bool
    title: str
    description: Optional[str] = None
    visibility: StreamVisibility
    target_section_ids: List[str] = Field(default_factory=list)
    thumbnail_url: Optional[str] = None
    status: StreamStatus
    viewer_count: int = 0
    allow_participant_camera: bool
    allow_participant_mic: bool
    entry_start: Optional[datetime] = None
    entry_deadline: Optional[datetime] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    is_organizer: bool = False

    model_config = ConfigDict(from_attributes=True)


class SpeakRequestResponse(BaseModel):
    id: str
    meethub_session_id: str
    user_id: str
    username: str
    avatar: Optional[str] = None
    status: str
    requested_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AttendanceRecordResponse(BaseModel):
    user_id: str
    username: str
    avatar: Optional[str] = None
    status: str
    first_joined_at: Optional[datetime] = None
    marked_at: Optional[datetime] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AttendanceRosterEntry(BaseModel):
    """One section student, merged with any attendance record for this
    specific Meethub session - status is None when the student simply
    hasn't been marked yet, which is distinct from 'absent'."""
    user_id: str
    username: str
    avatar: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str
    is_officer: bool = False
    is_mayor: bool = False
    is_online: bool = False
    status: Optional[str] = None
    first_joined_at: Optional[datetime] = None
    marked_at: Optional[datetime] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AttendanceUpsert(BaseModel):
    user_id: str
    status: str = Field(..., pattern="^(present|late|excused|absent)$")
    notes: Optional[str] = Field(None, max_length=500)
