# backend/app/models/announcement.py
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Enum, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from datetime import datetime

class Announcement(Base):
    __tablename__ = "announcements"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    type = Column(Enum('general', 'academic', 'event', 'emergency', name='announcement_type'), default='general')
    priority = Column(Enum('low', 'normal', 'high', 'urgent', name='priority_level'), default='normal')
    created_by_role = Column(String(50))  # 'admin' or 'professor'
    is_published = Column(Boolean, default=True)
    published_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="announcements")
    targets = relationship("AnnouncementTarget", back_populates="announcement", cascade="all, delete-orphan")

class AnnouncementTarget(Base):
    __tablename__ = "announcement_targets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    announcement_id = Column(UUID(as_uuid=True), ForeignKey("announcements.id", ondelete="CASCADE"))
    target_type = Column(String(50))  # 'role' or 'section'
    target_id = Column(String(100))   # Role name or section ID
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    announcement = relationship("Announcement", back_populates="targets")