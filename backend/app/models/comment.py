# backend/app/models/comment.py
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Integer, Index, and_
from app.core.db_types import UTCDateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, foreign
from app.core.database import Base
import uuid
from datetime import datetime

class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    parent_id = Column(UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)
    content = Column(Text, nullable=False)
    image_url = Column(String(500))
    likes_count = Column(Integer, default=0)
    created_at = Column(UTCDateTime, default=datetime.utcnow)
    updated_at = Column(UTCDateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="comments")
    post = relationship("Post", back_populates="comments")
    replies = relationship("Comment", back_populates="parent", cascade="all, delete-orphan")
    parent = relationship("Comment", back_populates="replies", remote_side=[id])
    
    # ⚠️ FIXED: Added primaryjoin and foreign specifier for polymorphic Like table
    likes = relationship(
        "Like",
        primaryjoin="and_(foreign(Like.target_id)==Comment.id, Like.target_type=='comment')",
        viewonly=True,
        cascade="all, delete-orphan",
    )


class CommentReaction(Base):
    """One Discord-style emoji reaction per user per comment - mirrors
    PostReaction exactly (see post.py). Separate from the older binary
    `Like` table, which stays intact for backward compat."""
    __tablename__ = "comment_reactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comment_id = Column(UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reaction = Column(String(16), nullable=False)
    created_at = Column(UTCDateTime, default=datetime.utcnow)

    comment = relationship("Comment")
    user = relationship("User")


Index(
    "uq_comment_reactions_comment_user",
    CommentReaction.comment_id,
    CommentReaction.user_id,
    unique=True,
)