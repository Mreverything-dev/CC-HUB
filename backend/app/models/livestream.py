# backend/app/models/livestream.py
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Integer, Boolean, JSON, Enum, Index
from app.core.db_types import UTCDateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from datetime import datetime
import enum

class StreamStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    ENDED = "ended"

class StreamVisibility(str, enum.Enum):
    PUBLIC = "public"
    FRIENDS = "friends"
    SECTION = "section"

class Livestream(Base):
    __tablename__ = "livestreams"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    host_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    visibility = Column(Enum(StreamVisibility), default=StreamVisibility.PUBLIC)
    status = Column(Enum(StreamStatus), default=StreamStatus.SCHEDULED)
    target_section_ids = Column(JSON, default=list)  # For section visibility
    stream_key = Column(String(255), unique=True)
    viewer_count = Column(Integer, default=0)
    started_at = Column(UTCDateTime)
    ended_at = Column(UTCDateTime)
    created_at = Column(UTCDateTime, default=datetime.utcnow)
    updated_at = Column(UTCDateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    host = relationship("User", back_populates="livestreams")
    viewers = relationship("StreamViewer", back_populates="stream", cascade="all, delete-orphan")

class StreamViewer(Base):
    __tablename__ = "stream_viewers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stream_id = Column(UUID(as_uuid=True), ForeignKey("livestreams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(UTCDateTime, default=datetime.utcnow)
    left_at = Column(UTCDateTime)
    is_active = Column(Boolean, default=True)

    # Relationships
    stream = relationship("Livestream", back_populates="viewers")
    user = relationship("User")


class StreamComment(Base):
    """A live-chat message for a stream. Also doubles as a reply when
    parent_comment_id is set - one level of nesting only, matching the
    existing chat UI's flat timeline plus "replying to" affordance."""
    __tablename__ = "stream_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stream_id = Column(UUID(as_uuid=True), ForeignKey("livestreams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_comment_id = Column(UUID(as_uuid=True), ForeignKey("stream_comments.id", ondelete="CASCADE"), nullable=True)
    content = Column(Text, nullable=False)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(UTCDateTime, default=datetime.utcnow)

    # Relationships
    stream = relationship("Livestream")
    user = relationship("User")
    reactions = relationship("StreamCommentReaction", back_populates="comment", cascade="all, delete-orphan")


class StreamCommentReaction(Base):
    """One reaction per user per comment - re-reacting with the same emoji
    removes it, a different emoji replaces it (enforced in the service)."""
    __tablename__ = "stream_comment_reactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comment_id = Column(UUID(as_uuid=True), ForeignKey("stream_comments.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reaction = Column(String(16), nullable=False)
    created_at = Column(UTCDateTime, default=datetime.utcnow)

    # Relationships
    comment = relationship("StreamComment", back_populates="reactions")
    user = relationship("User")


Index(
    "uq_stream_viewers_active_stream_user",
    StreamViewer.stream_id,
    StreamViewer.user_id,
    unique=True,
    postgresql_where=StreamViewer.is_active.is_(True),
)

Index(
    "uq_stream_comment_reactions_comment_user",
    StreamCommentReaction.comment_id,
    StreamCommentReaction.user_id,
    unique=True,
)
