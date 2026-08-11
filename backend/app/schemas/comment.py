# backend/app/schemas/comment.py
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime

class CommentBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

class CommentCreate(CommentBase):
    parent_id: Optional[str] = None

class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

class CommentResponse(BaseModel):
    id: str
    post_id: str
    user_id: str
    username: str
    user_role: str = "student"
    avatar_url: Optional[str] = None
    parent_id: Optional[str] = None
    content: str
    likes_count: int = 0
    created_at: datetime
    updated_at: datetime
    is_liked_by_current_user: bool = False
    is_owned_by_current_user: bool = False

    model_config = ConfigDict(from_attributes=True)

class CommentListResponse(BaseModel):
    total: int
    items: List[CommentResponse]
