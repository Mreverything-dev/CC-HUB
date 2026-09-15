from sqlalchemy import Column, String, DateTime, func
from app.db.base_class import Base  # i-verify mo yung import path

class UserFrame(Base):
    __tablename__ = 'user_frames'
    user_id = Column(String, primary_key=True)
    frame_id = Column(String(50), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())