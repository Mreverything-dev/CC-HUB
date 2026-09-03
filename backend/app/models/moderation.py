# backend/app/models/moderation.py
from sqlalchemy import Column, String, ForeignKey
from app.core.db_types import UTCDateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from datetime import datetime


class UserRestriction(Base):
    """A time-boxed social-interaction restriction applied by an admin,
    almost always in response to a validated UserReport (report_id links
    back to it for moderation history, but is nullable so a restriction
    could in principle be applied without one).

    Deliberately has NO "is_active" flag - whether a restriction is
    currently in effect is always computed by comparing restricted_until to
    the current time (see ModerationService.get_active_restriction), so it
    expires automatically the instant that timestamp passes with no
    scheduled job, admin action, or write of any kind required. A user can
    accumulate multiple restriction rows over time (each one preserved
    forever as history); only the one with the latest restricted_until that
    hasn't passed yet is ever "the" active restriction.
    """
    __tablename__ = "user_restrictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String(100), nullable=False)
    report_id = Column(UUID(as_uuid=True), ForeignKey("user_reports.id", ondelete="SET NULL"), nullable=True)
    restricted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    restricted_at = Column(UTCDateTime, default=datetime.utcnow)
    restricted_until = Column(UTCDateTime, nullable=False)
    created_at = Column(UTCDateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    restricted_by_user = relationship("User", foreign_keys=[restricted_by])
