# backend/app/schemas/profile.py
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator
from typing import Optional
from datetime import datetime
import uuid

# ========== Student Profile Schemas ==========
class StudentProfileBase(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    student_id: Optional[str] = Field(None, max_length=50)
    course: Optional[str] = Field(None, max_length=100)
    year_level: Optional[int] = Field(None, ge=1, le=6)
    section_id: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=500)
    contact_number: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=255)

class StudentProfileCreate(StudentProfileBase):
    user_id: str

class StudentProfileUpdate(StudentProfileBase):
    pass

class StudentProfileResponse(StudentProfileBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_validator('id', 'user_id', 'section_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

# ========== Professor Profile Schemas ==========
class ProfessorProfileBase(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    employee_id: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=100)
    title: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=500)
    office: Optional[str] = Field(None, max_length=100)
    contact_number: Optional[str] = Field(None, max_length=20)

class ProfessorProfileCreate(ProfessorProfileBase):
    user_id: str

class ProfessorProfileUpdate(ProfessorProfileBase):
    pass

class ProfessorProfileResponse(ProfessorProfileBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_validator('id', 'user_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

# ========== Admin Profile Schemas ==========
class AdminProfileBase(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    position: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    contact_number: Optional[str] = Field(None, max_length=20)

class AdminProfileCreate(AdminProfileBase):
    user_id: str

class AdminProfileUpdate(AdminProfileBase):
    pass

class AdminProfileResponse(AdminProfileBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_validator('id', 'user_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

# ========== Combined Profile Response ==========
class UserProfileResponse(BaseModel):
    user_id: str
    email: str
    username: str
    role: str
    profile: Optional[StudentProfileResponse | ProfessorProfileResponse | AdminProfileResponse] = None