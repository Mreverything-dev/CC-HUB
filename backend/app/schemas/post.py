# backend/app/schemas/post.py
from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Optional, List, Dict
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
    @model_validator(mode="after")
    def require_content_or_media(self):
        if not (self.content and self.content.strip()) and not self.media_urls:
            raise ValueError("Post must include content or at least one media file")
        return self

# ============================================
# UPDATE SCHEMA
# ============================================

class PostUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1)
    visibility: Optional[PostVisibility] = None

class ReactionRequest(BaseModel):
    reaction: str = Field(..., min_length=1, max_length=16)

# ============================================
# RESPONSE SCHEMA
# ============================================

class PostResponse(PostBase):
    id: str
    user_id: str
    username: str
    user_role: str = "student"
    avatar_url: Optional[str] = None
    likes_count: int
    comments_count: int
    shares_count: int
    created_at: datetime
    updated_at: datetime
    is_liked_by_current_user: bool = False
    is_shared_by_current_user: bool = False
    is_owned_by_current_user: bool = False

    # --- Additive fields below: the new multi-emoji reaction system and the
    # "shared post" feed concept. Every existing field above is untouched -
    # old clients reading only likes_count/is_liked_by_current_user/etc. see
    # no change at all. ---
    reactions_count: int = 0
    reaction_breakdown: Dict[str, int] = Field(default_factory=dict)
    my_reaction: Optional[str] = None

    # Set only on a feed item that represents someone sharing this post
    # (see PostService.get_feed) - the post fields above are always the
    # ORIGINAL post's own content/author/reactions, never a copy.
    is_shared: bool = False
    shared_by_user_id: Optional[str] = None
    shared_by_username: Optional[str] = None
    shared_by_avatar_url: Optional[str] = None
    shared_by_role: Optional[str] = None
    shared_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# ============================================
# FEED RESPONSE
# ============================================

class FeedResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[PostResponse]