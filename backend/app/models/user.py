# backend/app/models/user.py
from sqlalchemy import Column, String, Boolean, DateTime, Enum, Table, ForeignKey, Text
from app.core.db_types import UTCDateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from app.models.conversation import Message
from datetime import datetime
from app.models.friend import Friend, FriendRequest
# Association Tables
user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE')),
    Column('role_id', UUID(as_uuid=True), ForeignKey('roles.id', ondelete='CASCADE'))
)

role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', UUID(as_uuid=True), ForeignKey('roles.id', ondelete='CASCADE')),
    Column('permission_id', UUID(as_uuid=True), ForeignKey('permissions.id', ondelete='CASCADE'))
)

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True)  # ✅ Token for verification
    verification_token_expires = Column(DateTime, nullable=True)  # ✅ Token expiration
    # The users.role column is a plain varchar in the live DB (never migrated
    # to a native enum), so the model must match that - a native Enum() here
    # makes SQLAlchemy bind an explicit ::user_roles cast that Postgres
    # rejects against a varchar column (UndefinedFunctionError).
    role = Column(String(50), default='student')
    last_login = Column(UTCDateTime)
    last_seen = Column(UTCDateTime)  # updated on WS connect/disconnect - see app/websocket/manager.py
    created_at = Column(UTCDateTime, default=datetime.utcnow)
    updated_at = Column(UTCDateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    livestreams = relationship("Livestream", back_populates="host", cascade="all, delete-orphan")
    # Relationships
    roles = relationship("Role", secondary=user_roles, back_populates="users")
    comments = relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")

    # Friend relationships
    friends = relationship("Friend", foreign_keys=[Friend.user_id], back_populates="user", cascade="all, delete-orphan")
    friend_of = relationship("Friend", foreign_keys=[Friend.friend_id], back_populates="friend", cascade="all, delete-orphan")
    sent_requests = relationship("FriendRequest", foreign_keys=[FriendRequest.sender_id], back_populates="sender", cascade="all, delete-orphan")
    received_requests = relationship("FriendRequest", foreign_keys=[FriendRequest.receiver_id], back_populates="receiver", cascade="all, delete-orphan")
    
    # Notifications
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

    # conversation Relationships
    conversations = relationship("ConversationMember", back_populates="user", cascade="all, delete-orphan")
    sent_messages = relationship("Message", foreign_keys=[Message.sender_id], back_populates="sender")
    # Profile relationships
    student_profile = relationship("StudentProfile", back_populates="user", uselist=False)
    professor_profile = relationship("ProfessorProfile", back_populates="user", uselist=False)
    admin_profile = relationship("AdminProfile", back_populates="user", uselist=False)
    posts = relationship("Post", back_populates="user", cascade="all, delete-orphan")
    announcements = relationship("Announcement", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User {self.email}>"

class Role(Base):
    __tablename__ = "roles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255))
    created_at = Column(UTCDateTime, default=datetime.utcnow)
    
    users = relationship("User", secondary=user_roles, back_populates="roles")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")
    
    def __repr__(self):
        return f"<Role {self.name}>"

class Permission(Base):
    __tablename__ = "permissions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    resource = Column(String(100))
    action = Column(String(50))
    description = Column(String(255))
    created_at = Column(UTCDateTime, default=datetime.utcnow)
    
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")
    
    def __repr__(self):
        return f"<Permission {self.name}>"
