# backend/app/models/invitation_code.py
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
import uuid
from datetime import datetime

class InvitationCode(Base):
    __tablename__ = "invitation_codes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False)
    role = Column(String(50), nullable=False)  # 'professor' or 'admin'
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    is_used = Column(Boolean, default=False)
    used_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)