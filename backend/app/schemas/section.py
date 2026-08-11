# backend/app/schemas/section.py
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator
from typing import Optional, List
from datetime import datetime
import uuid

class SectionBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    course: Optional[str] = Field(None, max_length=100)
    year_level: Optional[int] = Field(None, ge=1, le=6)
    academic_year: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = None

class SectionCreate(SectionBase):
    pass

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

    model_config = ConfigDict(from_attributes=True)

    @field_validator('id', 'section_id', 'user_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

# Update forward references
SectionResponse.model_rebuild()