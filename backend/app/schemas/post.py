# backend/app/schemas/post.py
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

# ============================================
# ENUMS
# ============================================

class PostType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    LINK = "link"
    POLL = "poll"
    EVENT = "event"

class PostVisibility(str, Enum):
    PUBLIC = "public"
    FRIENDS = "friends"
    SECTION = "section"
    PRIVATE = "private"

# ============================================
# BASE SCHEMA
# ============================================

class PostBase(BaseModel):
    content: Optional[str] = Field(None, description="Post content")
    type: PostType = PostType.TEXT
    visibility: PostVisibility = PostVisibility.PUBLIC
    media_urls: List[str] = Field(default_factory=list, description="List of media URLs")

# ============================================
# CREATE SCHEMA
# ============================================

class PostCreate(PostBase):
    content: str = Field(..., min_length=1, description="Post content is required for text posts")

# ============================================
# UPDATE SCHEMA
# ============================================

class PostUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1)
    visibility: Optional[PostVisibility] = None

# ============================================
# RESPONSE SCHEMA
# ============================================

class PostResponse(PostBase):
    id: str
    user_id: str
    username: str
    likes_count: int
    comments_count: int
    shares_count: int
    created_at: datetime
    updated_at: datetime
    is_liked_by_current_user: bool = False
    is_owned_by_current_user: bool = False
    
    model_config = ConfigDict(from_attributes=True)

# ============================================
# FEED RESPONSE
# ============================================

class FeedResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[PostResponse]