# backend/app/schemas/profile.py
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

# ========== Student Profile Schemas ==========
class StudentProfileBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    student_id: Optional[str] = None
    course: Optional[str] = None
    year_level: Optional[int] = None
    section_id: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    contact_number: Optional[str] = None
    address: Optional[str] = None

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

# ========== Professor Profile Schemas ==========
class ProfessorProfileBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    office: Optional[str] = None
    contact_number: Optional[str] = None

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

# ========== Admin Profile Schemas ==========
class AdminProfileBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    position: Optional[str] = None
    avatar_url: Optional[str] = None
    contact_number: Optional[str] = None

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

# ========== Combined Profile Response ==========
class UserProfileResponse(BaseModel):
    user_id: str
    email: str
    username: str
    role: str
    profile: Optional[StudentProfileResponse | ProfessorProfileResponse | AdminProfileResponse] = None