# backend/app/models/teaching_assignment.py
from sqlalchemy import Column, String, ForeignKey, JSON, Time, Index
from app.core.db_types import UTCDateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from datetime import datetime

class TeachingAssignment(Base):
    """A professor's assignment to teach one subject in one section, on a
    schedule. A section can have many active assignments (many professors);
    a professor can have many active assignments (many sections)."""
    __tablename__ = "teaching_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    professor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id", ondelete="CASCADE"), nullable=False)
    subject = Column(String(150), nullable=False)
    schedule_days = Column(JSON, default=list)  # e.g. ["Mon", "Wed", "Fri"]
    schedule_start = Column(Time, nullable=False)
    schedule_end = Column(Time, nullable=False)
    status = Column(String(20), default="active")  # 'active' | 'inactive'
    created_at = Column(UTCDateTime, default=datetime.utcnow)
    updated_at = Column(UTCDateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    professor = relationship("User")
    section = relationship("Section", back_populates="teaching_assignments")


Index(
    "uq_teaching_assignments_active",
    TeachingAssignment.professor_id,
    TeachingAssignment.section_id,
    TeachingAssignment.subject,
    unique=True,
    postgresql_where=TeachingAssignment.status == "active",
)
