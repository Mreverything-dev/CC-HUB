# backend/app/schemas/friend.py
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal, Optional, List
from datetime import datetime
import uuid

class FriendRequestBase(BaseModel):
    message: Optional[str] = Field(None, max_length=255)

class FriendRequestCreate(FriendRequestBase):
    receiver_id: str

class FriendRequestUpdate(BaseModel):
    status: Literal['accepted', 'rejected']

class FriendRequestResponse(BaseModel):
    id: str
    sender_id: str
    sender_username: str
    sender_avatar: Optional[str] = None
    sender_online: bool = False
    receiver_id: str
    receiver_username: str
    receiver_avatar: Optional[str] = None
    receiver_online: bool = False
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
    role: Optional[str] = None
    is_online: bool = False
    last_seen: Optional[datetime] = None
    mutual_friends_count: int = 0
    mutual_friend_avatars: List[str] = Field(default_factory=list)
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

class SuggestionResponse(BaseModel):
    user_id: str
    username: str
    email: str
    avatar: Optional[str] = None
    role: Optional[str] = None
    mutual_friends_count: int = 0
    mutual_friend_avatars: List[str] = Field(default_factory=list)

class BlockedUserResponse(BaseModel):
    id: str
    user_id: str
    username: str
    email: str
    avatar: Optional[str] = None
    blocked_at: datetime

class BlockedUserListResponse(BaseModel):
    blocked: List[BlockedUserResponse]
    total: int

class UserReportCreate(BaseModel):
    reason: str = Field(..., max_length=50)
    details: Optional[str] = Field(None, max_length=500)