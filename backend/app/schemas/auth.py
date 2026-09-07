# backend/app/schemas/auth.py
from datetime import datetime
import re
import uuid
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer, validator

def _normalize_email(v: str) -> str:
    """Lowercase + strip so "User@Example.com" and "user@example.com" are
    always treated as the same address - for lookups (a Postgres text
    comparison is case-sensitive by default, so this affects real login
    reliability, not just security) and for rate-limit keys, which would
    otherwise let an attacker dodge the per-email limit just by varying case."""
    return v.strip().lower()


# Letters, digits, underscore, and dot only - matches users.username's
# real-world usage today and, importantly, guarantees a username can never
# contain "@", which is what login uses to tell an email apart from a
# username (see AuthService.login).
_USERNAME_RE = re.compile(r'^[A-Za-z0-9_.]{3,50}$')


def _validate_username_format(v: str) -> str:
    v = v.strip()
    if not _USERNAME_RE.match(v):
        raise ValueError(
            'Username must be 3-50 characters and can only contain letters, numbers, underscores, and dots'
        )
    return v


class UserBase(BaseModel):
    email: EmailStr = Field(..., max_length=255)
    username: str = Field(..., min_length=3, max_length=50)
    role: Literal["student", "professor", "admin"] = "student"

    @validator('email')
    def normalize_email(cls, v):
        return _normalize_email(v)

    @validator('username')
    def validate_username(cls, v):
        return _validate_username_format(v)

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=128)
    confirm_password: str = Field(..., max_length=128)

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

class UserSearchResult(UserResponse):
    """UserResponse plus display info from the user's role-specific profile
    (first/last name, avatar) - kept separate from UserResponse itself so
    auth flows (login/register) are completely unaffected."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None

class LoginRequest(BaseModel):
    # Named `email` for API compatibility with existing clients, but this
    # now accepts either a registered email address OR username - see
    # AuthService.login, which looks the value up against both columns.
    email: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., max_length=128)

    @validator('email')
    def normalize_identifier(cls, v):
        v = v.strip()
        if not v:
            raise ValueError('Email or username is required')
        # Only fold case for something that looks like an email - a
        # username's case is significant (registration never normalizes
        # it), so this must not silently lowercase e.g. "JohnDoe".
        return v.lower() if '@' in v else v

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
    terms_accepted: bool = False

    # always=True is required here: a pydantic v1-style @validator only
    # runs on a field that was actually present in the input by default -
    # since terms_accepted defaults to False, a request that omits the
    # field entirely would otherwise skip this check completely and
    # register successfully, exactly the bypass this validator exists to
    # prevent.
    @validator('terms_accepted', always=True)
    def validate_terms_accepted(cls, v):
        if not v:
            raise ValueError('You must accept the Terms and Conditions to register')
        return v

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse

# ✅ Registration no longer issues a usable session - an unverified account
# has no access token, so there's nothing to bypass verification with even
# if the frontend is ignored (e.g. a raw API call). See AuthService.register.
class RegisterResponse(BaseModel):
    message: str
    user: UserResponse
    requires_verification: bool = True

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# ✅ Add these schemas for email verification
class ResendVerificationRequest(BaseModel):
    email: EmailStr

    @validator('email')
    def normalize_email(cls, v):
        return _normalize_email(v)

class VerifyEmailResponse(BaseModel):
    message: str
    verified: bool

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    @validator('email')
    def normalize_email(cls, v):
        return _normalize_email(v)

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, max_length=128)
    confirm_password: str = Field(..., max_length=128)

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

class PasswordResetResponse(BaseModel):
    message: str
    success: bool

class VerificationStatusResponse(BaseModel):
    is_verified: bool
    email: str
    username: str

class UpdateUsernameRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)

    @validator('username')
    def validate_username(cls, v):
        return _validate_username_format(v)

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)
    confirm_password: str = Field(..., max_length=128)

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

class ChangePasswordResponse(BaseModel):
    message: str
    requires_verification: bool = True

class ConfirmChangePasswordResponse(BaseModel):
    message: str
    success: bool

class GoogleLoginRequest(BaseModel):
    code: str

class GoogleAuthResponse(TokenResponse):
    is_new_user: bool = False