# backend/app/models/friend.py
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Boolean, Index
from app.core.db_types import UTCDateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from datetime import datetime

class Friend(Base):
    __tablename__ = "friends"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    friend_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    created_at = Column(UTCDateTime, default=datetime.utcnow)
    updated_at = Column(UTCDateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="friends")
    friend = relationship("User", foreign_keys=[friend_id])

class FriendRequest(Base):
    __tablename__ = "friend_requests"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    receiver_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    status = Column(String(20), default='pending')  # 'pending' | 'accepted' | 'rejected' | 'cancelled'
    message = Column(Text)
    created_at = Column(UTCDateTime, default=datetime.utcnow)
    updated_at = Column(UTCDateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_requests")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_requests")


class BlockedUser(Base):
    """blocker_id has blocked blocked_id - one-directional. Blocking removes
    any existing friendship/pending requests between the two (see
    FriendService.block_user) and prevents new friend requests either way."""
    __tablename__ = "blocked_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blocker_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(UTCDateTime, default=datetime.utcnow)

    blocker = relationship("User", foreign_keys=[blocker_id])
    blocked = relationship("User", foreign_keys=[blocked_id])


class UserReport(Base):
    """A user-submitted report against another user, OR (when post_id is
    set) against one of their posts specifically - the same table backs
    both, extended rather than duplicated. reporter_id is stored purely for
    duplicate-prevention/abuse-prevention/audit (see the partial unique
    index below) - it must NEVER be serialized in any admin-facing API
    response or UI; the reported user and other admins must never be able
    to learn who filed a report. `reason` doubles as the structured
    category slug for post reports (bullying/harassment/abuse/
    violent_content/adult_content/false_information/suicide_self_harm,
    validated in the API schema) - reused as-is rather than adding a
    parallel `category` column, since it already held free-form
    reason strings for the pre-existing user-report flow.

    Moderation fields below turn what was previously "just records the
    report" into a real review workflow: status starts 'pending', an admin
    moves it to 'valid' or 'dismissed', and warning_issued/restriction_id/
    post_removed record exactly what action (if any) was taken - preserved
    permanently as this report's own moderation history."""
    __tablename__ = "user_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reported_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String(50), nullable=False)
    details = Column(Text)
    created_at = Column(UTCDateTime, default=datetime.utcnow)

    # Post-report extension - NULL for a plain user-report (the original,
    # still-supported use case).
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="SET NULL"), nullable=True)

    # Moderation workflow
    status = Column(String(20), nullable=False, default="pending")  # pending | valid | dismissed
    moderated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    moderated_at = Column(UTCDateTime, nullable=True)
    warning_issued = Column(Boolean, nullable=False, default=False)
    post_removed = Column(Boolean, nullable=False, default=False)
    restriction_id = Column(UUID(as_uuid=True), ForeignKey("user_restrictions.id", ondelete="SET NULL"), nullable=True)

    reporter = relationship("User", foreign_keys=[reporter_id])
    reported = relationship("User", foreign_keys=[reported_id])
    moderator = relationship("User", foreign_keys=[moderated_by])
    post = relationship("Post")
    restriction = relationship("UserRestriction", foreign_keys=[restriction_id])


Index("uq_blocked_users_blocker_blocked", BlockedUser.blocker_id, BlockedUser.blocked_id, unique=True)

# One report per (reporter, post) - lets the same reporter file separate
# reports against different posts, or against the same user without a
# post_id, but blocks repeatedly reporting the identical post. Partial
# (post_id IS NOT NULL) so it never constrains the original plain
# user-report rows, which have no post_id at all.
Index(
    "uq_user_reports_reporter_post",
    UserReport.reporter_id,
    UserReport.post_id,
    unique=True,
    postgresql_where=UserReport.post_id.isnot(None),
)