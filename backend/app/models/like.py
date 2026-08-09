# backend/app/models/like.py
import uuid
from datetime import datetime

from sqlalchemy import Column, String, ForeignKey, DateTime, and_
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, foreign
from app.core.database import Base

class Like(Base):
    __tablename__ = "likes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    target_type = Column(String(50))  # 'post' or 'comment'
    target_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="likes")
    post = relationship(
        "Post",
        primaryjoin="and_(foreign(Like.target_id)==Post.id, Like.target_type=='post')",
        viewonly=True,
    )
    comment = relationship(
        "Comment",
        primaryjoin="and_(foreign(Like.target_id)==Comment.id, Like.target_type=='comment')",
        viewonly=True,
    )
