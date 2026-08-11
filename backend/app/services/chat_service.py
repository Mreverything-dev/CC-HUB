# backend/app/services/chat_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_, or_, func
from sqlalchemy.orm import selectinload
from app.models.conversation import Conversation, ConversationMember, Message
from app.models.user import User
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.schemas.chat import ConversationCreate, MessageCreate
from fastapi import HTTPException, status
from datetime import datetime
from typing import List, Optional
from sqlalchemy import select, desc, and_, or_, func, update
class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_avatar_url(self, user_id: str, role: str) -> Optional[str]:
        """Get a user's avatar URL from their role-specific profile"""
        model = {
            "student": StudentProfile,
            "professor": ProfessorProfile,
            "admin": AdminProfile,
        }.get(role)
        if not model:
            return None
        result = await self.db.execute(
            select(model.avatar_url).where(model.user_id == user_id)
        )
        return result.scalar_one_or_none()

    # ============================================
    # CONVERSATION METHODS
    # ============================================
    
    async def get_or_create_direct_conversation(self, user_id: str, other_user_id: str):
        """Get or create a direct conversation between two users"""
        # Check if conversation exists
        result = await self.db.execute(
            select(Conversation)
            .join(ConversationMember)
            .where(
                Conversation.type == "direct",
                ConversationMember.user_id == user_id,
                Conversation.id.in_(
                    select(ConversationMember.conversation_id)
                    .where(ConversationMember.user_id == other_user_id)
                )
            )
        )
        conversation = result.scalar_one_or_none()
        
        if conversation:
            return conversation
        
        # Create new conversation
        conversation = Conversation(type="direct")
        self.db.add(conversation)
        await self.db.flush()
        
        # Add participants
        for uid in [user_id, other_user_id]:
            member = ConversationMember(conversation_id=conversation.id, user_id=uid)
            self.db.add(member)
        
        await self.db.commit()
        await self.db.refresh(conversation)
        return conversation

    async def create_group_conversation(self, user_id: str, data: ConversationCreate):
        """Create a group conversation"""
        conversation = Conversation(
            type="group",
            name=data.name or "Group Chat"
        )
        self.db.add(conversation)
        await self.db.flush()
        
        # Add creator as member
        member = ConversationMember(conversation_id=conversation.id, user_id=user_id)
        self.db.add(member)
        
        # Add other participants
        for participant_id in data.participant_ids:
            if participant_id != user_id:
                member = ConversationMember(conversation_id=conversation.id, user_id=participant_id)
                self.db.add(member)
        
        await self.db.commit()
        await self.db.refresh(conversation)
        return conversation

    async def get_user_conversations(self, user_id: str, limit: int = 50):
        """Get all conversations for a user"""
        result = await self.db.execute(
            select(Conversation)
            .join(ConversationMember)
            .where(ConversationMember.user_id == user_id)
            .order_by(desc(Conversation.updated_at))
            .limit(limit)
            .options(selectinload(Conversation.members))
            .options(selectinload(Conversation.messages))
        )
        conversations = result.scalars().all()
        
        # Get last message and unread count for each conversation
        for conv in conversations:
            # Get last message (with sender eager-loaded so we can fill sender_username)
            msg_result = await self.db.execute(
                select(Message)
                .where(Message.conversation_id == conv.id)
                .order_by(desc(Message.created_at))
                .limit(1)
                .options(selectinload(Message.sender))
            )
            last_message = msg_result.scalar_one_or_none()
            if last_message:
                last_message.sender_username = last_message.sender.username if last_message.sender else "Unknown"
                last_message.sender_avatar = (
                    await self._get_avatar_url(str(last_message.sender_id), last_message.sender.role)
                    if last_message.sender else None
                )
            conv.last_message = last_message

            # Get unread count
            count_result = await self.db.execute(
                select(func.count())
                .where(
                    Message.conversation_id == conv.id,
                    Message.is_read == False,
                    Message.sender_id != user_id
                )
            )
            conv.unread_count = count_result.scalar()

            # Get participants (as plain dicts - ConversationResponse.participants is typed as List[dict])
            participants = await self.db.execute(
                select(User)
                .join(ConversationMember)
                .where(ConversationMember.conversation_id == conv.id)
            )
            conv.participants = [
                {"id": str(u.id), "username": u.username, "email": u.email}
                for u in participants.scalars().all()
            ]
        
        return conversations

    # ============================================
    # MESSAGE METHODS
    # ============================================
    
    async def send_message(self, user_id: str, data: MessageCreate):
        """Send a message to a conversation"""
        # Check if conversation exists
        conv_result = await self.db.execute(
            select(Conversation).where(Conversation.id == data.conversation_id)
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        
        # Check if user is a member
        member_result = await self.db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == data.conversation_id,
                ConversationMember.user_id == user_id
            )
        )
        if not member_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this conversation"
            )
        
        # Create message
        message = Message(
            conversation_id=data.conversation_id,
            sender_id=user_id,
            content=data.content,
            type=data.type
        )
        self.db.add(message)
        
        # Update conversation timestamp
        conversation.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(message)
        
        return message

    async def get_conversation_messages(self, conversation_id: str, user_id: str, limit: int = 50, before: Optional[datetime] = None):
        """Get messages from a conversation with pagination"""
        # Check if user is a member
        member_result = await self.db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id
            )
        )
        if not member_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this conversation"
            )
        
        query = select(Message).where(Message.conversation_id == conversation_id).options(selectinload(Message.sender))

        if before:
            query = query.where(Message.created_at < before)

        query = query.order_by(desc(Message.created_at)).limit(limit)

        result = await self.db.execute(query)
        messages = result.scalars().all()

        for message in messages:
            message.sender_username = message.sender.username if message.sender else "Unknown"
            message.sender_avatar = (
                await self._get_avatar_url(str(message.sender_id), message.sender.role)
                if message.sender else None
            )

        # Mark messages as read
        await self.db.execute(
            update(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.sender_id != user_id,
                Message.is_read == False
            )
            .values(is_read=True, read_at=datetime.utcnow())
        )
        await self.db.commit()
        
        return messages[::-1]  # Return in chronological order

    async def mark_message_as_read(self, message_id: str, user_id: str):
        """Mark a specific message as read"""
        result = await self.db.execute(
            select(Message).where(Message.id == message_id)
        )
        message = result.scalar_one_or_none()
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
        
        if message.sender_id != user_id:
            message.is_read = True
            message.read_at = datetime.utcnow()
            await self.db.commit()
        
        return message

    async def get_conversation_participants(self, conversation_id: str):
        """Get all participants of a conversation"""
        result = await self.db.execute(
            select(User)
            .join(ConversationMember)
            .where(ConversationMember.conversation_id == conversation_id)
        )
        return result.scalars().all()