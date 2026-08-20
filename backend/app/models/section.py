# backend/app/models/section.py
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Boolean, Text
from app.core.db_types import UTCDateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from datetime import datetime

class Section(Base):
    __tablename__ = "sections"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    course = Column(String(100))
    year_level = Column(Integer)
    academic_year = Column(String(20))
    advisor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    description = Column(Text)
    created_at = Column(UTCDateTime, default=datetime.utcnow)
    updated_at = Column(UTCDateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # ✅ Relationships
    advisor = relationship("User", foreign_keys=[advisor_id])
    members = relationship("SectionMember", back_populates="section", cascade="all, delete-orphan")
    teaching_assignments = relationship("TeachingAssignment", back_populates="section", cascade="all, delete-orphan")

class SectionMember(Base):
    __tablename__ = "section_members"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    role = Column(String(50), default="student")
    is_officer = Column(Boolean, default=False)
    is_mayor = Column(Boolean, default=False)
    joined_at = Column(UTCDateTime, default=datetime.utcnow)
    
    # ✅ Relationships
    section = relationship("Section", back_populates="members")
    user = relationship("User")