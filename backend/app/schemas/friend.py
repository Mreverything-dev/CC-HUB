# backend/app/schemas/friend.py
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import datetime
import uuid

class FriendRequestBase(BaseModel):
    message: Optional[str] = Field(None, max_length=255)

class FriendRequestCreate(FriendRequestBase):
    receiver_id: str

class FriendRequestUpdate(BaseModel):
    status: str  # 'accepted' or 'rejected'

class FriendRequestResponse(BaseModel):
    id: str
    sender_id: str
    sender_username: str
    sender_avatar: Optional[str] = None
    receiver_id: str
    receiver_username: str
    receiver_avatar: Optional[str] = None
    status: str
    message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_validator('id', 'sender_id', 'receiver_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

class FriendResponse(BaseModel):
    id: str
    user_id: str
    username: str
    email: str
    avatar: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_validator('id', 'user_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

class FriendListResponse(BaseModel):
    friends: List[FriendResponse]
    total: int

class FriendRequestListResponse(BaseModel):
    sent: List[FriendRequestResponse]
    received: List[FriendRequestResponse]
    total: int