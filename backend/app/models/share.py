# backend/app/models/share.py
from sqlalchemy import Column, ForeignKey, DateTime, UniqueConstraint
from app.core.db_types import UTCDateTime
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
import uuid
from datetime import datetime

class Share(Base):
    __tablename__ = "shares"
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_share_user_post"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"))
    created_at = Column(UTCDateTime, default=datetime.utcnow)
