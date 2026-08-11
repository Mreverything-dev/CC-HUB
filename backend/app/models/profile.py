# backend/app/models/profile.py
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from datetime import datetime

class StudentProfile(Base):
    __tablename__ = "student_profiles"
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    first_name = Column(String(100))
    last_name = Column(String(100))
    student_id = Column(String(50), unique=True)
    course = Column(String(100))
    year_level = Column(Integer)
    section_id = Column(UUID(as_uuid=True))
    avatar_url = Column(Text)  # ✅ Avatar URL for profile picture
    bio = Column(Text)
    contact_number = Column(String(20))
    address = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="student_profile")

    def __repr__(self):
        return f"<StudentProfile {self.user_id}>"

class ProfessorProfile(Base):
    __tablename__ = "professor_profiles"
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    first_name = Column(String(100))
    last_name = Column(String(100))
    employee_id = Column(String(50), unique=True)
    department = Column(String(100))
    title = Column(String(100))
    avatar_url = Column(Text)  # ✅ Avatar URL for profile picture
    bio = Column(Text)
    office = Column(String(100))
    contact_number = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="professor_profile")

    def __repr__(self):
        return f"<ProfessorProfile {self.user_id}>"

class AdminProfile(Base):
    __tablename__ = "admin_profiles"
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    first_name = Column(String(100))
    last_name = Column(String(100))
    position = Column(String(100))
    avatar_url = Column(Text)  # ✅ Avatar URL for profile picture
    contact_number = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="admin_profile")

    def __repr__(self):
        return f"<AdminProfile {self.user_id}>"