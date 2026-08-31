# backend/app/schemas/chat.py
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import datetime
import uuid

class ConversationBase(BaseModel):
    type: str = "direct"
    name: Optional[str] = None

class ConversationCreate(ConversationBase):
    participant_ids: List[str]  # User IDs to add to conversation

class ConversationResponse(BaseModel):
    id: str
    type: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    last_message: Optional['MessageResponse'] = None
    unread_count: int = 0
    participants: List[dict] = []

    model_config = ConfigDict(from_attributes=True)

    @field_validator('id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

class ConversationLogoUpdate(BaseModel):
    avatar_url: str = Field(..., min_length=1, max_length=500)

class GroupMemberResponse(BaseModel):
    id: str
    username: str
    full_name: str
    avatar_url: Optional[str] = None
    role: str  # 'student' | 'professor' | 'admin'
    is_professor: bool = False
    is_mayor: bool = False
    is_officer: bool = False

class MessageBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    type: str = "text"
    media_url: Optional[str] = None
    media_name: Optional[str] = None

class MessageCreate(MessageBase):
    conversation_id: str

class MessageReactionSummary(BaseModel):
    user_id: str
    reaction: str

class MessageReactionRequest(BaseModel):
    reaction: str = Field(..., min_length=1, max_length=16)

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_username: str
    sender_avatar: Optional[str] = None
    content: str
    type: str
    media_url: Optional[str] = None
    media_name: Optional[str] = None
    reactions: List[MessageReactionSummary] = Field(default_factory=list)
    is_read: bool
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator('id', 'conversation_id', 'sender_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

class ChatListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int