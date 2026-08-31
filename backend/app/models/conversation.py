# backend/app/models/conversation.py
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text, Index
from app.core.db_types import UTCDateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from datetime import datetime

class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(String(20), default="direct")  # 'direct' or 'group'
    name = Column(String(100), nullable=True)  # For group chats
    avatar_url = Column(String(500), nullable=True)  # Group chat logo - direct conversations never set this
    created_at = Column(UTCDateTime, default=datetime.utcnow)
    updated_at = Column(UTCDateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    members = relationship("ConversationMember", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class ConversationMember(Base):
    __tablename__ = "conversation_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    joined_at = Column(UTCDateTime, default=datetime.utcnow)
    last_read_at = Column(UTCDateTime, default=datetime.utcnow)
    # "Delete chat" is per-user only - this member's own row (and their
    # membership/message access) is untouched; it's just hidden from THEIR
    # conversation list (ChatService.get_user_conversations) until either a
    # new message arrives in it or they explicitly re-open it (both clear
    # this back to NULL - see ChatService.send_message and
    # SectionConversationService._ensure_member). Nothing is ever deleted.
    hidden_at = Column(UTCDateTime, nullable=True)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="members")
    user = relationship("User")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"))
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    content = Column(Text, nullable=False)
    type = Column(String(50), default="text")  # text, image, video, file
    media_url = Column(String(500))
    media_name = Column(String(255))  # original filename, shown for file-type attachments
    is_read = Column(Boolean, default=False)
    read_at = Column(UTCDateTime, nullable=True)
    # "Unsend" - soft delete, same pattern as StreamComment.is_deleted:
    # content/media are wiped and the row stays (so message order/ids for
    # reactions etc. are undisturbed) instead of being actually removed.
    # Visible to every participant via the message:unsent broadcast.
    is_deleted = Column(Boolean, default=False)
    created_at = Column(UTCDateTime, default=datetime.utcnow)
    updated_at = Column(UTCDateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")


class MessageReaction(Base):
    """One Discord-style emoji reaction per user per message - re-reacting
    with the same emoji removes it, a different emoji replaces it (enforced
    in ChatService.react_to_message)."""
    __tablename__ = "message_reactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reaction = Column(String(16), nullable=False)
    created_at = Column(UTCDateTime, default=datetime.utcnow)

    message = relationship("Message")
    user = relationship("User")


Index(
    "uq_message_reactions_message_user",
    MessageReaction.message_id,
    MessageReaction.user_id,
    unique=True,
)


class MessageHiddenFor(Base):
    """'Remove for Me' - mirrors MessageReaction's exact (message, user)
    shape. Purely a per-viewer visibility flag: ChatService.
    get_conversation_messages excludes a message for whichever users have a
    row here, but the Message row itself, its content, and every other
    participant's view are completely untouched - the opposite of Unsend
    (Message.is_deleted), which removes it for everyone."""
    __tablename__ = "message_hidden_for"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(UTCDateTime, default=datetime.utcnow)

    message = relationship("Message")
    user = relationship("User")


Index(
    "uq_message_hidden_for_message_user",
    MessageHiddenFor.message_id,
    MessageHiddenFor.user_id,
    unique=True,
)