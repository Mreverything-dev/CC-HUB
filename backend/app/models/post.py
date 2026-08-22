# backend/app/models/post.py
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Enum, Integer, JSON, Index
from app.core.db_types import UTCDateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from datetime import datetime

class Post(Base):
    __tablename__ = "posts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    content = Column(Text)
    type = Column(String(50), default='text')
    visibility = Column(String(20), default='public')
    
    media_urls = Column(JSON, default=list)
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)
    created_at = Column(UTCDateTime, default=datetime.utcnow)
    updated_at = Column(UTCDateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship(
        "Like",
        primaryjoin="and_(foreign(Like.target_id)==Post.id, Like.target_type=='post')",
        viewonly=True,
        cascade="all, delete-orphan",
    )
    media = relationship("PostMedia", back_populates="post", cascade="all, delete-orphan")

class PostMedia(Base):
    __tablename__ = "post_media"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"))
    media_url = Column(String(500), nullable=False)
    media_type = Column(String(50))
    created_at = Column(UTCDateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="media")


class PostReaction(Base):
    """One Discord-style emoji reaction per user per post - re-reacting with
    the same emoji removes it, a different emoji replaces it (enforced in
    PostService.react_to_post). Deliberately separate from the older binary
    `Like` table (kept fully intact for backward compat) rather than
    extending it, mirroring AnnouncementReaction/MessageReaction."""
    __tablename__ = "post_reactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reaction = Column(String(16), nullable=False)
    created_at = Column(UTCDateTime, default=datetime.utcnow)

    post = relationship("Post")
    user = relationship("User")


Index(
    "uq_post_reactions_post_user",
    PostReaction.post_id,
    PostReaction.user_id,
    unique=True,
)