# backend/app/models/section.py
from sqlalchemy import Boolean, Column, String, Integer, ForeignKey, DateTime, Table
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
    description = Column(String(500))
    advisor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SectionMember(Base):
    __tablename__ = "section_members"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    role = Column(String(50), default="student")
    is_officer = Column(Boolean, default=False)   # ✅ SQLAlchemy Column
    is_mayor = Column(Boolean, default=False)     # ✅ SQLAlchemy Column
    joined_at = Column(DateTime, default=datetime.utcnow)