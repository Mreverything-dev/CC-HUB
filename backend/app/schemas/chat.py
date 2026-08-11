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

class MessageBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    type: str = "text"

class MessageCreate(MessageBase):
    conversation_id: str

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_username: str
    sender_avatar: Optional[str] = None
    content: str
    type: str
    is_read: bool
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