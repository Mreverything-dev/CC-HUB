# backend/app/schemas/announcement.py
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid

# ============================================
# ENUMS
# ============================================

class AnnouncementType(str, Enum):
    GENERAL = "general"
    ACADEMIC = "academic"
    EVENT = "event"
    EMERGENCY = "emergency"

class PriorityLevel(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"

# ============================================
# BASE SCHEMA
# ============================================

class AnnouncementBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Announcement title")
    content: str = Field(..., min_length=1, description="Announcement content")
    type: AnnouncementType = AnnouncementType.GENERAL
    priority: PriorityLevel = PriorityLevel.NORMAL
    is_published: bool = True
    expires_at: Optional[datetime] = None
    target_roles: Optional[List[str]] = Field(
        default=None,
        description="List of roles to target: ['student', 'professor', 'admin']"
    )
    target_sections: Optional[List[str]] = Field(
        default=None,
        description="List of section IDs to target"
    )
    
    model_config = ConfigDict(use_enum_values=True)

# ============================================
# CREATE SCHEMA
# ============================================

class AnnouncementCreate(AnnouncementBase):
    pass

# ============================================
# UPDATE SCHEMA
# ============================================

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    type: Optional[AnnouncementType] = None
    priority: Optional[PriorityLevel] = None
    is_published: Optional[bool] = None
    expires_at: Optional[datetime] = None
    target_roles: Optional[List[str]] = None
    target_sections: Optional[List[str]] = None
    
    model_config = ConfigDict(use_enum_values=True)

# ============================================
# RESPONSE SCHEMA
# ============================================

# ✅ REMOVED AnnouncementTargetResponse - not needed

class AnnouncementResponse(BaseModel):
    id: str
    user_id: str
    title: str
    content: str
    type: str
    priority: str
    created_by_role: str
    created_by_username: Optional[str] = None
    is_published: bool
    published_at: datetime
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    target_sections: Optional[List[str]] = None  # ✅ Keep this - it's the sections the announcement targets
    
    model_config = ConfigDict(from_attributes=True)
    
    # ✅ Convert UUID to string
    @field_validator('id', 'user_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

# ============================================
# LIST RESPONSE SCHEMA
# ============================================

class AnnouncementListResponse(BaseModel):
    total: int
    items: List[AnnouncementResponse]

# ============================================
# ANNOUNCEMENT FILTERS
# ============================================

class AnnouncementFilters(BaseModel):
    type: Optional[AnnouncementType] = None
    priority: Optional[PriorityLevel] = None
    is_published: Optional[bool] = None
    created_by_role: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    search: Optional[str] = Field(None, description="Search in title and content")
    
    model_config = ConfigDict(use_enum_values=True)