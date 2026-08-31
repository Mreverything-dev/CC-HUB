# backend/app/services/teaching_assignment_conversation_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.models.teaching_assignment import TeachingAssignment, TeachingAssignmentConversation
from app.models.section import Section, SectionMember
from app.models.conversation import Conversation, ConversationMember
from app.services.chat_service import ChatService
from fastapi import HTTPException, status
from typing import Optional
import logging
import uuid as uuid_lib

logger = logging.getLogger(__name__)


class TeachingAssignmentConversationService:
    """Provisions each teaching assignment's (one subject taught in one
    section) dedicated group Conversation - mirrors
    SectionConversationService one level down, reusing the exact same
    Conversation/ConversationMember chat tables (via ChatService for
    participant enrichment) rather than a parallel messaging system.
    TeachingAssignmentConversation.teaching_assignment_id/conversation_id
    are both unique, so a subject can never end up with more than one group."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.chat_service = ChatService(db)

    @staticmethod
    def _as_uuid(value):
        """See SectionConversationService._as_uuid - same reason: bulk
        inserts don't reliably coerce a plain str to UUID for asyncpg."""
        return value if isinstance(value, uuid_lib.UUID) else uuid_lib.UUID(str(value))

    async def _get_link(self, teaching_assignment_id: str) -> Optional[TeachingAssignmentConversation]:
        result = await self.db.execute(
            select(TeachingAssignmentConversation).where(
                TeachingAssignmentConversation.teaching_assignment_id == teaching_assignment_id
            )
        )
        return result.scalar_one_or_none()

    async def _get_conversation(self, conversation_id) -> Conversation:
        result = await self.db.execute(select(Conversation).where(Conversation.id == conversation_id))
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject conversation not found")
        conversation.participants = await self.chat_service._build_participants(str(conversation.id))
        return conversation

    async def _ensure_member(self, conversation_id, user_id: str):
        existing_result = await self.db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            # Mirrors SectionConversationService._ensure_member - re-opening
            # this subject's chat also restores it if the caller had
            # previously "deleted" it from their own chat list.
            if existing.hidden_at is not None:
                existing.hidden_at = None
                await self.db.commit()
            return
        self.db.add(ConversationMember(conversation_id=conversation_id, user_id=self._as_uuid(user_id)))
        await self.db.commit()

    async def get_or_create(self, assignment: TeachingAssignment) -> Conversation:
        """Returns the subject's group conversation, creating it (seeded
        with every current section member plus the assigned professor) the
        first time it's needed - called right after a teaching assignment is
        successfully created, never before. Naming: "{Section Name}
        {Subject Code}" (e.g. "BSIT 4-3 MELEC 8"), falling back to just the
        section name if no subject code was given. A concurrent duplicate
        create is resolved the same way SectionConversationService handles
        it - the unique constraint on teaching_assignment_id catches it and
        the caller gets back whichever one committed first."""
        assignment_id = str(assignment.id)
        link = await self._get_link(assignment_id)
        if link:
            return await self._get_conversation(link.conversation_id)

        section_result = await self.db.execute(select(Section).where(Section.id == assignment.section_id))
        section = section_result.scalar_one_or_none()
        if not section:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

        name = f"{section.name} {assignment.subject_code}".strip() if assignment.subject_code else section.name
        conversation = Conversation(type="group", name=(name or "Subject")[:100])
        self.db.add(conversation)
        await self.db.flush()

        member_ids = {str(assignment.professor_id)}
        sm_result = await self.db.execute(
            select(SectionMember.user_id).where(SectionMember.section_id == assignment.section_id)
        )
        member_ids.update(str(r) for r in sm_result.scalars().all())

        for uid in member_ids:
            self.db.add(ConversationMember(conversation_id=conversation.id, user_id=self._as_uuid(uid)))

        self.db.add(
            TeachingAssignmentConversation(
                teaching_assignment_id=self._as_uuid(assignment_id),
                conversation_id=conversation.id,
            )
        )
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            logger.info(f"Teaching assignment {assignment_id} conversation already created concurrently - reusing it")
            link = await self._get_link(assignment_id)
            if not link:
                raise
            return await self._get_conversation(link.conversation_id)

        await self.db.refresh(conversation)
        conversation.participants = await self.chat_service._build_participants(str(conversation.id))
        return conversation

    async def sync_new_section_member(self, section_id: str, user_id: str):
        """Adds `user_id` to every active subject conversation already
        provisioned for this section - mirrors SectionConversationService's
        own ensure_user_id sync, one level down, for a student joining the
        section. A subject that has no conversation yet is left alone (it
        gets seeded correctly the moment it's first created), so this never
        creates a conversation on a student's behalf."""
        result = await self.db.execute(
            select(TeachingAssignment.id).where(
                TeachingAssignment.section_id == section_id,
                TeachingAssignment.status == "active",
            )
        )
        for assignment_id in result.scalars().all():
            link = await self._get_link(str(assignment_id))
            if link:
                await self._ensure_member(link.conversation_id, user_id)

    async def remove_section_member(self, section_id: str, user_id: str):
        """Mirrors sync_new_section_member, in reverse, for a student
        leaving the section."""
        result = await self.db.execute(
            select(TeachingAssignment.id).where(TeachingAssignment.section_id == section_id)
        )
        for assignment_id in result.scalars().all():
            link = await self._get_link(str(assignment_id))
            if not link:
                continue
            member_result = await self.db.execute(
                select(ConversationMember).where(
                    ConversationMember.conversation_id == link.conversation_id,
                    ConversationMember.user_id == user_id,
                )
            )
            member = member_result.scalar_one_or_none()
            if member:
                await self.db.delete(member)
                await self.db.commit()
