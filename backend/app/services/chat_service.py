# backend/app/services/chat_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_, or_, func
from sqlalchemy.orm import selectinload
from app.models.conversation import Conversation, ConversationMember, Message, MessageReaction
from app.models.user import User
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.models.section import Section, SectionMember, SectionConversation
from app.models.teaching_assignment import TeachingAssignment, TeachingAssignmentConversation
from app.schemas.chat import ConversationCreate, MessageCreate
from fastapi import HTTPException, status
from datetime import datetime
from typing import List, Optional
from sqlalchemy import select, desc, and_, or_, func, update

ALLOWED_REACTIONS = {"❤️", "👍", "😂", "😮", "😢", "🔥", "🚀"}

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

    async def _get_profile_names(self, user_id: str, role: str) -> tuple[Optional[str], Optional[str]]:
        """First/last name from a user's role-specific profile - mirrors
        SectionService's own helper of the same name/shape."""
        model = {
            "student": StudentProfile,
            "professor": ProfessorProfile,
            "admin": AdminProfile,
        }.get(role)
        if not model:
            return None, None
        result = await self.db.execute(
            select(model.first_name, model.last_name).where(model.user_id == user_id)
        )
        row = result.first()
        return (row[0], row[1]) if row else (None, None)

    async def _build_participants(self, conversation_id: str) -> List[dict]:
        """Participant list (with avatar) for a conversation - shared by every
        path that returns a ConversationResponse, so newly-created
        conversations are just as fully populated as ones from the list
        endpoint (previously only the list endpoint set this, so a brand new
        conversation had an empty participants array and the frontend showed
        "Unknown User")."""
        result = await self.db.execute(
            select(User)
            .join(ConversationMember)
            .where(ConversationMember.conversation_id == conversation_id)
        )
        users = result.scalars().all()
        return [
            {
                "id": str(u.id),
                "username": u.username,
                "email": u.email,
                "avatar_url": await self._get_avatar_url(str(u.id), u.role),
            }
            for u in users
        ]

    async def _get_message_reactions(self, message_id: str) -> List[dict]:
        result = await self.db.execute(
            select(MessageReaction).where(MessageReaction.message_id == message_id)
        )
        return [{"user_id": str(r.user_id), "reaction": r.reaction} for r in result.scalars().all()]

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
            conversation.participants = await self._build_participants(str(conversation.id))
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
        conversation.participants = await self._build_participants(str(conversation.id))
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
        conversation.participants = await self._build_participants(str(conversation.id))
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
            conv.participants = await self._build_participants(str(conv.id))
        
        return conversations

    # ============================================
    # GROUP CHAT MEMBERS + LOGO
    # ============================================

    async def _require_group_conversation(self, conversation_id: str, user_id: str) -> Conversation:
        """Loads the conversation, 404s if missing, 403s if the caller isn't
        actually a member, 400s if it isn't a group at all - the same guard
        every group-only action below needs first."""
        result = await self.db.execute(select(Conversation).where(Conversation.id == conversation_id))
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        if conversation.type != "group":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not a group conversation")

        member_result = await self.db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
            )
        )
        if not member_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this conversation")
        return conversation

    async def _resolve_group_section(self, conversation_id: str) -> tuple[Optional[str], set]:
        """For a group conversation, returns (section_id, professor_ids) -
        the underlying section (via SectionConversation directly, or via
        TeachingAssignmentConversation -> TeachingAssignment for a subject
        chat) and whichever user ids count as "the professor" for THIS
        specific group: every active professor for a section chat, but only
        the one assigned professor for a subject chat. Every group
        conversation in this app is one or the other (there's no ad-hoc
        group-creation UI), so a (None, set()) result means the link is
        missing/broken, not a third kind of group."""
        sec_link = await self.db.execute(
            select(SectionConversation.section_id).where(SectionConversation.conversation_id == conversation_id)
        )
        section_id = sec_link.scalar_one_or_none()
        if section_id:
            section_id = str(section_id)
            professor_ids = set()
            section_result = await self.db.execute(select(Section).where(Section.id == section_id))
            section = section_result.scalar_one_or_none()
            if section and section.advisor_id:
                professor_ids.add(str(section.advisor_id))
            ta_result = await self.db.execute(
                select(TeachingAssignment.professor_id).where(
                    TeachingAssignment.section_id == section_id,
                    TeachingAssignment.status == "active",
                )
            )
            professor_ids.update(str(r) for r in ta_result.scalars().all())
            return section_id, professor_ids

        ta_link = await self.db.execute(
            select(TeachingAssignmentConversation.teaching_assignment_id).where(
                TeachingAssignmentConversation.conversation_id == conversation_id
            )
        )
        assignment_id = ta_link.scalar_one_or_none()
        if assignment_id:
            ta_result = await self.db.execute(
                select(TeachingAssignment).where(TeachingAssignment.id == assignment_id)
            )
            assignment = ta_result.scalar_one_or_none()
            if assignment:
                return str(assignment.section_id), {str(assignment.professor_id)}

        return None, set()

    async def get_group_members(self, conversation_id: str, requesting_user_id: str) -> List[dict]:
        """Enriched member list for a group's Members panel - avatar, full
        name, and role (Professor/Mayor/Officer/Student), sourced from the
        SAME section membership that already governs this group's real
        Conversation/ConversationMember rows, not a separate roster."""
        await self._require_group_conversation(conversation_id, requesting_user_id)
        section_id, professor_ids = await self._resolve_group_section(conversation_id)

        section_member_map = {}
        if section_id:
            sm_result = await self.db.execute(select(SectionMember).where(SectionMember.section_id == section_id))
            for sm in sm_result.scalars().all():
                section_member_map[str(sm.user_id)] = sm

        result = await self.db.execute(
            select(User).join(ConversationMember).where(ConversationMember.conversation_id == conversation_id)
        )
        users = result.scalars().all()

        members = []
        for u in users:
            uid = str(u.id)
            sm = section_member_map.get(uid)
            first_name, last_name = await self._get_profile_names(uid, u.role)
            full_name = f"{first_name or ''} {last_name or ''}".strip() or u.username
            members.append({
                "id": uid,
                "username": u.username,
                "full_name": full_name,
                "avatar_url": await self._get_avatar_url(uid, u.role),
                "role": u.role,
                "is_professor": uid in professor_ids,
                "is_mayor": bool(sm.is_mayor) if sm else False,
                "is_officer": bool(sm.is_officer) if sm else False,
            })

        def sort_key(m: dict):
            rank = 0 if m["is_professor"] else 1 if m["is_mayor"] else 2 if m["is_officer"] else 3
            return (rank, m["full_name"].lower())

        return sorted(members, key=sort_key)

    async def can_edit_group_logo(self, conversation_id: str, user_id: str) -> bool:
        """Professor(s), mayor, and officer may change a group's logo;
        everyone else (students) can only view it."""
        section_id, professor_ids = await self._resolve_group_section(conversation_id)
        if user_id in professor_ids:
            return True
        if not section_id:
            return False
        sm_result = await self.db.execute(
            select(SectionMember).where(
                SectionMember.section_id == section_id,
                SectionMember.user_id == user_id,
            )
        )
        sm = sm_result.scalar_one_or_none()
        return bool(sm and (sm.is_mayor or sm.is_officer))

    async def update_group_logo(self, conversation_id: str, user_id: str, avatar_url: str) -> Conversation:
        conversation = await self._require_group_conversation(conversation_id, user_id)
        if not await self.can_edit_group_logo(conversation_id, user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the professor, mayor, or officer can change the group logo",
            )
        conversation.avatar_url = avatar_url
        conversation.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(conversation)
        conversation.participants = await self._build_participants(str(conversation.id))
        return conversation

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
            type=data.type,
            media_url=data.media_url,
            media_name=data.media_name
        )
        self.db.add(message)
        
        # Update conversation timestamp
        conversation.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(message)
        message.reactions = []  # brand new message, nothing to react to yet

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
            message.reactions = await self._get_message_reactions(str(message.id))

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

    # ============================================
    # REACTIONS
    # ============================================

    async def react_to_message(self, message_id: str, user_id: str, reaction: str) -> dict:
        """Add/change/remove the caller's reaction on a message - same-emoji
        toggles it off, a different emoji replaces it. Mirrors
        StreamCommentService.react_to_comment / AnnouncementService's
        reaction toggle."""
        if reaction not in ALLOWED_REACTIONS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported reaction")

        message_result = await self.db.execute(select(Message).where(Message.id == message_id))
        message = message_result.scalar_one_or_none()
        if not message:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

        # Only members of the conversation may react to its messages.
        member_result = await self.db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == message.conversation_id,
                ConversationMember.user_id == user_id
            )
        )
        if not member_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this conversation"
            )

        existing_result = await self.db.execute(
            select(MessageReaction).where(
                MessageReaction.message_id == message_id,
                MessageReaction.user_id == user_id,
            )
        )
        existing = existing_result.scalar_one_or_none()

        if existing and existing.reaction == reaction:
            await self.db.delete(existing)
            new_reaction = None
        elif existing:
            existing.reaction = reaction
            new_reaction = reaction
        else:
            self.db.add(MessageReaction(message_id=message_id, user_id=user_id, reaction=reaction))
            new_reaction = reaction

        await self.db.commit()
        reactions = await self._get_message_reactions(message_id)

        return {
            "message_id": str(message_id),
            "conversation_id": str(message.conversation_id),
            "user_id": str(user_id),
            "reaction": new_reaction,
            "reactions": reactions,
        }