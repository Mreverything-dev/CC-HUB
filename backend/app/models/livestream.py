# backend/app/models/livestream.py
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Integer, Boolean, JSON, Enum
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
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    host = relationship("User", back_populates="livestreams")
    viewers = relationship("StreamViewer", back_populates="stream", cascade="all, delete-orphan")

class StreamViewer(Base):
    __tablename__ = "stream_viewers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stream_id = Column(UUID(as_uuid=True), ForeignKey("livestreams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    stream = relationship("Livestream", back_populates="viewers")
    user = relationship("User")