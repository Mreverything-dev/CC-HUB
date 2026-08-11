# backend/app/models/notification.py
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from datetime import datetime

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    type = Column(String(50), nullable=False)  # 'friend_request', 'friend_accepted', 'message', etc.
    title = Column(String(255))
    content = Column(Text)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    data = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    user = relationship("User", back_populates="notifications")