# backend/app/models/friend.py
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Index
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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
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
    created_at = Column(DateTime, default=datetime.utcnow)

    blocker = relationship("User", foreign_keys=[blocker_id])
    blocked = relationship("User", foreign_keys=[blocked_id])


class UserReport(Base):
    """A user-submitted report against another user (harassment, spam, etc).
    No moderation/review workflow exists yet - this just records the report."""
    __tablename__ = "user_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reported_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String(50), nullable=False)
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    reporter = relationship("User", foreign_keys=[reporter_id])
    reported = relationship("User", foreign_keys=[reported_id])


Index("uq_blocked_users_blocker_blocked", BlockedUser.blocker_id, BlockedUser.blocked_id, unique=True)