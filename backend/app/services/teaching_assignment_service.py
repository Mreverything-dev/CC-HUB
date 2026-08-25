# backend/app/services/teaching_assignment_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.section import Section
from app.models.teaching_assignment import TeachingAssignment
from app.models.user import User
from app.models.profile import ProfessorProfile
from app.schemas.section import TeachingAssignmentCreate, TeachingAssignmentUpdate
from fastapi import HTTPException, status
from typing import List, Optional
from datetime import time
import logging

logger = logging.getLogger(__name__)

DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


class TeachingAssignmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_section(self, section_id: str) -> Section:
        result = await self.db.execute(select(Section).where(Section.id == section_id))
        section = result.scalar_one_or_none()
        if not section:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
        return section

    async def _get_assignment(self, assignment_id: str) -> TeachingAssignment:
        result = await self.db.execute(
            select(TeachingAssignment).where(TeachingAssignment.id == assignment_id)
        )
        assignment = result.scalar_one_or_none()
        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teaching assignment not found")
        return assignment

    async def _enrich(self, assignment: TeachingAssignment) -> dict:
        user_result = await self.db.execute(
            select(User, ProfessorProfile)
            .outerjoin(ProfessorProfile, ProfessorProfile.user_id == User.id)
            .where(User.id == assignment.professor_id)
        )
        row = user_result.first()
        user_obj, profile = row if row else (None, None)

        section_result = await self.db.execute(
            select(Section.name).where(Section.id == assignment.section_id)
        )
        section_name = section_result.scalar_one_or_none()

        return {
            "id": str(assignment.id),
            "section_id": str(assignment.section_id),
            "professor_id": str(assignment.professor_id),
            "subject": assignment.subject,
            "subject_code": assignment.subject_code,
            "room": assignment.room,
            "schedule_days": assignment.schedule_days or [],
            "schedule_start": assignment.schedule_start,
            "schedule_end": assignment.schedule_end,
            "status": assignment.status,
            "created_at": assignment.created_at,
            "updated_at": assignment.updated_at,
            "professor_username": user_obj.username if user_obj else None,
            "professor_first_name": profile.first_name if profile else None,
            "professor_last_name": profile.last_name if profile else None,
            "professor_avatar": profile.avatar_url if profile else None,
            "section_name": section_name,
        }

    async def _check_schedule_conflict(
        self,
        professor_id: str,
        days: List[str],
        start: time,
        end: time,
        exclude_assignment_id: Optional[str] = None,
    ):
        """Basic conflict check: the same professor's other active
        assignments must not share a day AND overlap in time range."""
        if start >= end or not days:
            return  # zero-duration or day-less schedules (e.g. legacy backfill rows) can't conflict

        query = select(TeachingAssignment).where(
            TeachingAssignment.professor_id == professor_id,
            TeachingAssignment.status == "active",
        )
        if exclude_assignment_id:
            query = query.where(TeachingAssignment.id != exclude_assignment_id)

        result = await self.db.execute(query)
        day_set = set(days)
        for other in result.scalars().all():
            other_days = set(other.schedule_days or [])
            if not day_set & other_days:
                continue
            if start < other.schedule_end and other.schedule_start < end:
                section = await self._get_section(str(other.section_id))
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"You already have a teaching schedule during this time: "
                        f"{other.subject} in {section.name} "
                        f"({', '.join(other_days)} {other.schedule_start.strftime('%H:%M')}-"
                        f"{other.schedule_end.strftime('%H:%M')})."
                    ),
                )

    async def create_assignment(
        self, section_id: str, data: TeachingAssignmentCreate, requesting_user: User
    ) -> dict:
        section = await self._get_section(section_id)

        professor_id = str(requesting_user.id)
        if requesting_user.role == "admin" and data.professor_id:
            professor_id = data.professor_id
        elif requesting_user.role != "professor" and requesting_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only professors and admins can create teaching assignments",
            )

        prof_result = await self.db.execute(select(User).where(User.id == professor_id))
        professor = prof_result.scalar_one_or_none()
        if not professor or professor.role != "professor":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Professor not found")

        dup_result = await self.db.execute(
            select(TeachingAssignment).where(
                TeachingAssignment.professor_id == professor_id,
                TeachingAssignment.section_id == section_id,
                TeachingAssignment.status == "active",
                func.lower(TeachingAssignment.subject) == data.subject.lower(),
            )
        )
        if dup_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You are already teaching {data.subject} in {section.name}.",
            )

        await self._check_schedule_conflict(
            professor_id, data.schedule_days, data.schedule_start, data.schedule_end
        )

        assignment = TeachingAssignment(
            professor_id=professor_id,
            section_id=section_id,
            subject=data.subject,
            subject_code=data.subject_code,
            room=data.room,
            schedule_days=data.schedule_days,
            schedule_start=data.schedule_start,
            schedule_end=data.schedule_end,
            status="active",
        )
        self.db.add(assignment)
        await self.db.commit()
        await self.db.refresh(assignment)

        # ✅ Keep the section's group chat in sync - lazily creates it (seeded
        # with every current member/professor) if this section doesn't have
        # one yet. Never let a chat-provisioning failure block the assignment.
        try:
            from app.services.section_conversation_service import SectionConversationService
            await SectionConversationService(self.db).get_or_create(section_id, ensure_user_id=professor_id)
        except Exception:
            logger.exception(f"Failed to sync group chat membership for professor {professor_id} in section {section_id}")

        # ✅ Provision the subject's own dedicated group chat, seeded with
        # every current section member plus the assigned professor - only
        # after the assignment above has actually committed successfully.
        # Never let a chat-provisioning failure block the assignment itself.
        try:
            from app.services.teaching_assignment_conversation_service import TeachingAssignmentConversationService
            await TeachingAssignmentConversationService(self.db).get_or_create(assignment)
        except Exception:
            logger.exception(f"Failed to auto-provision subject group chat for assignment {assignment.id}")

        return await self._enrich(assignment)

    async def list_for_section(self, section_id: str) -> List[dict]:
        result = await self.db.execute(
            select(TeachingAssignment).where(TeachingAssignment.section_id == section_id)
        )
        return [await self._enrich(a) for a in result.scalars().all()]

    async def list_mine(self, professor_id: str) -> List[dict]:
        result = await self.db.execute(
            select(TeachingAssignment)
            .where(TeachingAssignment.professor_id == professor_id)
            .order_by(TeachingAssignment.created_at.desc())
        )
        return [await self._enrich(a) for a in result.scalars().all()]

    async def update_assignment(
        self, assignment_id: str, data: TeachingAssignmentUpdate, requesting_user: User
    ) -> dict:
        assignment = await self._get_assignment(assignment_id)

        if requesting_user.role != "admin" and str(assignment.professor_id) != str(requesting_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to edit this teaching assignment",
            )

        update_fields = data.model_dump(exclude_unset=True)
        # professor_id/section_id are intentionally not part of TeachingAssignmentUpdate at all -
        # ownership can never be reassigned through this endpoint.
        new_days = update_fields.get("schedule_days", assignment.schedule_days or [])
        new_start = update_fields.get("schedule_start", assignment.schedule_start)
        new_end = update_fields.get("schedule_end", assignment.schedule_end)
        if any(k in update_fields for k in ("schedule_days", "schedule_start", "schedule_end")):
            await self._check_schedule_conflict(
                str(assignment.professor_id), new_days, new_start, new_end,
                exclude_assignment_id=assignment_id,
            )

        for key, value in update_fields.items():
            setattr(assignment, key, value)

        await self.db.commit()
        await self.db.refresh(assignment)
        return await self._enrich(assignment)

    async def delete_assignment(self, assignment_id: str, requesting_user: User) -> dict:
        assignment = await self._get_assignment(assignment_id)

        if requesting_user.role != "admin" and str(assignment.professor_id) != str(requesting_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to remove this teaching assignment",
            )

        section_id = str(assignment.section_id)
        professor_id = str(assignment.professor_id)

        # Deletes only this one row. TeachingAssignment.section_id is a FK
        # pointing AT Section, never the reverse, so this can never cascade
        # into deleting the section, its students, mayor, officer, or any
        # other professor's assignment.
        await self.db.delete(assignment)
        await self.db.commit()

        # ✅ Only drop the professor from the section's group chat if they
        # have no other reason to be there (no other active assignment in
        # this section, and they're not the legacy sole advisor).
        try:
            from app.services.section_conversation_service import SectionConversationService
            remaining = await self.db.execute(
                select(TeachingAssignment.id).where(
                    TeachingAssignment.section_id == section_id,
                    TeachingAssignment.professor_id == professor_id,
                    TeachingAssignment.status == "active",
                )
            )
            section = await self._get_section(section_id)
            still_advisor = str(section.advisor_id) == professor_id
            if not remaining.first() and not still_advisor:
                await SectionConversationService(self.db).remove_member(section_id, professor_id)
        except Exception:
            logger.exception(f"Failed to remove professor {professor_id} from section {section_id}'s group chat")

        return {"message": "Teaching assignment removed successfully"}
