# backend/app/schemas/livestream.py
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid

class StreamStatus(str, Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    ENDED = "ended"

class StreamVisibility(str, Enum):
    PUBLIC = "public"
    FRIENDS = "friends"
    SECTION = "section"

class LivestreamBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    visibility: StreamVisibility = StreamVisibility.PUBLIC
    target_section_ids: List[str] = Field(default_factory=list)
    thumbnail_url: Optional[str] = Field(None, max_length=500)

class LivestreamCreate(LivestreamBase):
    pass

class LivestreamUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    visibility: Optional[StreamVisibility] = None
    target_section_ids: Optional[List[str]] = None
    thumbnail_url: Optional[str] = Field(None, max_length=500)
    status: Optional[StreamStatus] = None

class LivestreamResponse(LivestreamBase):
    id: str
    host_id: str
    host_username: str
    host_avatar: Optional[str] = None
    host_role: str
    status: StreamStatus
    viewer_count: int
    stream_key: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    is_host: bool = False
    can_view: bool = False
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_validator('id', 'host_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

class StreamViewerResponse(BaseModel):
    id: str
    user_id: str
    username: str
    avatar: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    joined_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_validator('id', 'user_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

class StreamViewerCount(BaseModel):
    viewer_count: int

class StreamChatMessage(BaseModel):
    stream_id: str
    user_id: str
    username: str
    avatar: Optional[str] = None
    message: str
    timestamp: datetime