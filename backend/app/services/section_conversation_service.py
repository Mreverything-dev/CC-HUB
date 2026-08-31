# backend/app/services/section_conversation_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.models.section import Section, SectionMember, SectionConversation
from app.models.teaching_assignment import TeachingAssignment
from app.models.conversation import Conversation, ConversationMember
from app.services.chat_service import ChatService
from fastapi import HTTPException, status
from typing import Optional
import logging
import uuid as uuid_lib

logger = logging.getLogger(__name__)


class SectionConversationService:
    """Provisions and keeps in sync each section's dedicated group
    Conversation - reuses the existing Conversation/ConversationMember chat
    tables (via ChatService for participant enrichment) rather than a
    separate messaging system. SectionConversation.section_id/conversation_id
    are both unique, so a section can never end up with more than one group."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.chat_service = ChatService(db)

    @staticmethod
    def _as_uuid(value):
        """Coerce a str/UUID user id to a real uuid.UUID instance. Multi-row
        bulk inserts (used when seeding a brand-new group with every current
        member) go through SQLAlchemy's insertmanyvalues path, which - unlike
        a normal single-row flush - does not reliably run the UUID column's
        string-to-UUID bind conversion, so asyncpg receives a plain str and
        rejects it. Passing genuine uuid.UUID objects sidesteps that
        entirely, matching how id/conversation_id are already real UUID
        objects rather than strings."""
        return value if isinstance(value, uuid_lib.UUID) else uuid_lib.UUID(str(value))

    async def _get_link(self, section_id: str) -> Optional[SectionConversation]:
        result = await self.db.execute(
            select(SectionConversation).where(SectionConversation.section_id == section_id)
        )
        return result.scalar_one_or_none()

    async def _get_conversation(self, conversation_id) -> Conversation:
        result = await self.db.execute(select(Conversation).where(Conversation.id == conversation_id))
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section conversation not found")
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
            # Re-opening the section (this is called on every "get the
            # section's group chat" request) also restores it if the caller
            # had previously "deleted" it from their own chat list - a
            # deliberate re-open is as good a restore signal as a new
            # message arriving (see ChatService.send_message).
            if existing.hidden_at is not None:
                existing.hidden_at = None
                await self.db.commit()
            return
        self.db.add(ConversationMember(conversation_id=conversation_id, user_id=self._as_uuid(user_id)))
        await self.db.commit()

    async def get_or_create(self, section_id: str, ensure_user_id: Optional[str] = None) -> Conversation:
        """Returns the section's group conversation, creating it (seeded with
        every current member/professor) the first time it's needed. If it
        already exists and ensure_user_id is given, that user is added if
        they're not already a member - covers a student/professor joining a
        section that already has a group."""
        link = await self._get_link(section_id)
        if link:
            if ensure_user_id:
                await self._ensure_member(link.conversation_id, ensure_user_id)
            return await self._get_conversation(link.conversation_id)

        section_result = await self.db.execute(select(Section).where(Section.id == section_id))
        section = section_result.scalar_one_or_none()
        if not section:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

        conversation = Conversation(type="group", name=f"{section.name} Group Chat")
        self.db.add(conversation)
        await self.db.flush()

        member_ids = set()
        if section.advisor_id:
            member_ids.add(str(section.advisor_id))
        if ensure_user_id:
            member_ids.add(ensure_user_id)

        ta_result = await self.db.execute(
            select(TeachingAssignment.professor_id).where(
                TeachingAssignment.section_id == section_id,
                TeachingAssignment.status == "active",
            )
        )
        member_ids.update(str(r) for r in ta_result.scalars().all())

        sm_result = await self.db.execute(
            select(SectionMember.user_id).where(SectionMember.section_id == section_id)
        )
        member_ids.update(str(r) for r in sm_result.scalars().all())

        for uid in member_ids:
            self.db.add(ConversationMember(conversation_id=conversation.id, user_id=self._as_uuid(uid)))

        self.db.add(SectionConversation(section_id=self._as_uuid(section_id), conversation_id=conversation.id))
        try:
            await self.db.commit()
        except IntegrityError:
            # Someone else (e.g. two members opening "Section Chat" at the
            # same moment, or a join happening while the section was being
            # created) already created this section's group in the time
            # between our _get_link() check and this commit - the unique
            # constraint on SectionConversation.section_id caught it. Roll
            # back our half-made conversation and hand back the one that won,
            # instead of surfacing this as a failure to the caller.
            await self.db.rollback()
            logger.info(f"Section {section_id} conversation already created concurrently - reusing it")
            link = await self._get_link(section_id)
            if not link:
                raise
            if ensure_user_id:
                await self._ensure_member(link.conversation_id, ensure_user_id)
            return await self._get_conversation(link.conversation_id)

        await self.db.refresh(conversation)
        conversation.participants = await self.chat_service._build_participants(str(conversation.id))
        return conversation

    async def remove_member(self, section_id: str, user_id: str):
        """No-op if the section has no group yet - nothing to remove from."""
        link = await self._get_link(section_id)
        if not link:
            return
        result = await self.db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == link.conversation_id,
                ConversationMember.user_id == user_id,
            )
        )
        member = result.scalar_one_or_none()
        if member:
            await self.db.delete(member)
            await self.db.commit()
