# backend/app/schemas/section.py
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator
from typing import Optional, List
from datetime import datetime, time
import uuid

class SectionBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    course: Optional[str] = Field(None, max_length=100)
    year_level: Optional[int] = Field(None, ge=1, le=6)
    academic_year: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = None

class SectionCreate(SectionBase):
    # Optional - if provided, an initial TeachingAssignment is created for
    # the creating professor alongside the section. Omitting these leaves
    # section creation behaving exactly as before.
    subject: Optional[str] = Field(None, max_length=150)
    subject_code: Optional[str] = Field(None, max_length=50)
    room: Optional[str] = Field(None, max_length=100)
    schedule_days: Optional[List[str]] = None
    schedule_start: Optional[time] = None
    schedule_end: Optional[time] = None

class SectionUpdate(SectionBase):
    pass

class SectionResponse(BaseModel):
    id: str
    name: str
    course: Optional[str] = None
    year_level: Optional[int] = None
    academic_year: Optional[str] = None
    advisor_id: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    member_count: Optional[int] = 0
    members: Optional[List['SectionMemberResponse']] = None
    teaching_assignments: Optional[List['TeachingAssignmentResponse']] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator('id', 'advisor_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

class SectionMemberBase(BaseModel):
    user_id: str
    role: str = "student"
    is_officer: bool = False
    is_mayor: bool = False

class SectionMemberCreate(BaseModel):
    user_id: str
    role: str = "student"

class SectionMemberUpdate(BaseModel):
    role: Optional[str] = None
    is_officer: Optional[bool] = None
    is_mayor: Optional[bool] = None

class SectionMemberResponse(BaseModel):
    id: str
    section_id: str
    user_id: str
    role: str
    is_officer: bool
    is_mayor: bool
    joined_at: datetime
    user_email: Optional[str] = None
    user_username: Optional[str] = None
    user_avatar: Optional[str] = None
    user_first_name: Optional[str] = None
    user_last_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator('id', 'section_id', 'user_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

class TeachingAssignmentCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=150)
    # Optional at the schema level so existing callers that don't collect
    # these (e.g. JoinSectionModal) keep working unchanged - AddSubjectModal
    # and CreateSectionModal enforce them as required in their own forms.
    subject_code: Optional[str] = Field(None, max_length=50)
    room: Optional[str] = Field(None, max_length=100)
    schedule_days: List[str] = Field(default_factory=list)
    schedule_start: time
    schedule_end: time
    # Admin-only: assign a specific professor on their behalf. Professors
    # calling this endpoint may only ever create assignments for themselves;
    # the service layer enforces that, this field is simply ignored for them.
    professor_id: Optional[str] = None

class TeachingAssignmentUpdate(BaseModel):
    subject: Optional[str] = Field(None, min_length=1, max_length=150)
    subject_code: Optional[str] = Field(None, max_length=50)
    room: Optional[str] = Field(None, max_length=100)
    schedule_days: Optional[List[str]] = None
    schedule_start: Optional[time] = None
    schedule_end: Optional[time] = None
    status: Optional[str] = None

class TeachingAssignmentResponse(BaseModel):
    id: str
    section_id: str
    professor_id: str
    subject: str
    subject_code: Optional[str] = None
    room: Optional[str] = None
    schedule_days: List[str] = Field(default_factory=list)
    schedule_start: time
    schedule_end: time
    status: str
    created_at: datetime
    updated_at: datetime
    professor_username: Optional[str] = None
    professor_first_name: Optional[str] = None
    professor_last_name: Optional[str] = None
    professor_avatar: Optional[str] = None
    section_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator('id', 'section_id', 'professor_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v


class TeachingAssignmentAttendanceEntry(BaseModel):
    """One persisted attendance record from one Meethub session held for a
    teaching assignment - the same rows the in-meeting Attendance tab wrote,
    surfaced here for the Professor Teaching Assignment / student-record views."""
    session_id: str
    session_title: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    user_id: str
    username: str
    avatar: Optional[str] = None
    status: str
    marked_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class SectionBrowseItem(BaseModel):
    id: str
    name: str
    course: Optional[str] = None
    year_level: Optional[int] = None
    academic_year: Optional[str] = None
    member_count: int = 0
    professor_count: int = 0
    already_teaching: bool = False

    model_config = ConfigDict(from_attributes=True)

    @field_validator('id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

# Update forward references
SectionResponse.model_rebuild()