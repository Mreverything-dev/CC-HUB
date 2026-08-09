# backend/app/schemas/auth.py
from datetime import datetime
import re
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer, validator

class UserBase(BaseModel):
    email: EmailStr
    username: str
    role: str = "student"

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    confirm_password: str
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        return v
    
    @validator('confirm_password')
    def passwords_match(cls, v, values, **kwargs):
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v

class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

    @field_serializer('id')
    def serialize_id(self, value: uuid.UUID) -> str:
        return str(value)

    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime) -> str:
        return value.isoformat()

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(UserCreate):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    student_id: Optional[str] = None
    course: Optional[str] = None
    year_level: Optional[int] = None
    section_id: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None
    position: Optional[str] = None
    invitation_code: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)
    confirm_password: str
    
    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v
    
    @validator('confirm_password')
    def passwords_match(cls, v, values, **kwargs):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v
