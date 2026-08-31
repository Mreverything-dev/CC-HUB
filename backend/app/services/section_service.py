# backend/app/services/section_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, exists, delete as sa_delete
from app.models.section import Section, SectionMember, SectionConversation
from app.models.teaching_assignment import TeachingAssignment, TeachingAssignmentConversation
from app.models.conversation import Conversation, Message
from app.models.user import User
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.schemas.section import SectionCreate, SectionUpdate
from fastapi import HTTPException, status
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class SectionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ============================================
    # HELPER METHODS
    # ============================================

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
        """First/last name from a user's role-specific profile, for search/display
        (e.g. a professor searching students by full name) - mirrors _get_avatar_url's
        per-role profile lookup pattern, kept separate so existing avatar callers
        are untouched."""
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

    async def _check_section_view_access(self, section: Section, user_id: str) -> bool:
        """Whether user_id may view this section's details/members at all -
        admin, one of its professors (advisor or active teaching assignment),
        or any of its members (student/mayor/officer). Used to stop a user
        from reading another section's roster by guessing its ID; every
        legitimate caller already only ever requests a section already in
        their own scoped `get_sections` list, so this is pure hardening."""
        user_result = await self.db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if user and user.role == "admin":
            return True

        section_id = str(section.id)
        if str(section.advisor_id) == user_id:
            return True
        if await self._is_active_teaching_professor(section_id, user_id):
            return True
        if await self._get_member(section_id, user_id):
            return True

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this section"
        )

    async def _get_section(self, section_id: str) -> Section:
        """Get a section by ID"""
        result = await self.db.execute(
            select(Section).where(Section.id == section_id)
        )
        section = result.scalar_one_or_none()
        if not section:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Section not found"
            )
        return section

    async def _is_active_teaching_professor(self, section_id: str, user_id: str) -> bool:
        """Whether user_id has an active TeachingAssignment on this section -
        the co-professor equivalent of "is the advisor", used everywhere the
        advisor_id check is widened to support many professors per section.
        A professor can have several active assignments here (multiple
        subjects in the same section), so this is a pure existence check -
        scalar_one_or_none() would raise MultipleResultsFound as soon as a
        professor had a second subject in the section."""
        result = await self.db.execute(
            select(
                exists().where(
                    TeachingAssignment.section_id == section_id,
                    TeachingAssignment.professor_id == user_id,
                    TeachingAssignment.status == "active",
                )
            )
        )
        return bool(result.scalar())

    async def _get_teaching_assignments_for_section(self, section_id: str) -> List[dict]:
        """Enriched teaching-assignment list for a section's response dict,
        mirroring how member responses embed user_email/user_username/user_avatar
        to avoid the frontend needing a separate profile fetch per professor."""
        result = await self.db.execute(
            select(TeachingAssignment, User, ProfessorProfile)
            .join(User, TeachingAssignment.professor_id == User.id)
            .outerjoin(ProfessorProfile, ProfessorProfile.user_id == User.id)
            .where(TeachingAssignment.section_id == section_id)
        )
        assignments = []
        for ta, user_obj, profile in result:
            assignments.append({
                "id": str(ta.id),
                "section_id": str(ta.section_id),
                "professor_id": str(ta.professor_id),
                "subject": ta.subject,
                "subject_code": ta.subject_code,
                "room": ta.room,
                "schedule_days": ta.schedule_days or [],
                "schedule_start": ta.schedule_start,
                "schedule_end": ta.schedule_end,
                "status": ta.status,
                "created_at": ta.created_at,
                "updated_at": ta.updated_at,
                "professor_username": user_obj.username,
                "professor_first_name": profile.first_name if profile else None,
                "professor_last_name": profile.last_name if profile else None,
                "professor_avatar": profile.avatar_url if profile else None,
            })
        return assignments

    async def _get_member(self, section_id: str, user_id: str) -> Optional[SectionMember]:
        """Get a member by section and user ID"""
        result = await self.db.execute(
            select(SectionMember).where(
                SectionMember.section_id == section_id,
                SectionMember.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    # ✅ ADD THIS METHOD - Permission check for section management
    async def _check_section_permission(self, section_id: str, user_id: str):
        """Check if user has permission to manage the section"""
        section = await self._get_section(section_id)
        
        user = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = user.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # ✅ Allow admin
        if user.role == "admin":
            logger.info(f"✅ Admin {user_id} has permission")
            return True
        
        # ✅ Allow section advisor (professor)
        if str(section.advisor_id) == user_id:
            logger.info(f"✅ Advisor {user_id} has permission")
            return True

        # ✅ Allow a co-professor with an active teaching assignment
        if await self._is_active_teaching_professor(section_id, user_id):
            logger.info(f"✅ Teaching-assignment professor {user_id} has permission")
            return True

        # ✅ Allow mayor or officer
        member = await self._get_member(section_id, user_id)
        if member and (member.is_mayor or member.is_officer):
            logger.info(f"✅ {'Mayor' if member.is_mayor else 'Officer'} {user_id} has permission")
            return True
        
        logger.warning(f"❌ User {user_id} does not have permission to manage section {section_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to manage this section"
        )

    async def _check_promotion_permission(self, section_id: str, user_id: str):
        """Stricter check for promoting/demoting Mayor or Officer - only one
        of the section's professors (advisor, or an active teaching
        assignment) or an admin may do this. Unlike _check_section_permission,
        a Mayor/Officer is NOT allowed here: they can manage day-to-day
        section membership, but must not be able to appoint/remove each
        other, which would let them bypass the professors."""
        section = await self._get_section(section_id)

        user_result = await self.db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if user.role == "admin" or str(section.advisor_id) == user_id:
            return True

        if await self._is_active_teaching_professor(section_id, user_id):
            return True

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only one of the section's professors or an admin can promote or demote members"
        )

    # ============================================
    # SECTION CRUD
    # ============================================
    
    async def create_section(self, data: SectionCreate, user_id: str):
        """Create a new section. If subject/schedule are provided, also
        creates the creating professor's initial TeachingAssignment - purely
        additive, omitting them behaves exactly as before."""
        section = Section(
            name=data.name,
            course=data.course,
            year_level=data.year_level,
            academic_year=data.academic_year,
            description=data.description,
            advisor_id=user_id
        )
        self.db.add(section)
        await self.db.flush()

        created_assignment: Optional[TeachingAssignment] = None
        if data.subject and data.schedule_start is not None and data.schedule_end is not None:
            from app.services.teaching_assignment_service import TeachingAssignmentService
            ta_service = TeachingAssignmentService(self.db)
            await ta_service._check_schedule_conflict(
                user_id, data.schedule_days or [], data.schedule_start, data.schedule_end
            )
            created_assignment = TeachingAssignment(
                professor_id=user_id,
                section_id=section.id,
                subject=data.subject,
                subject_code=data.subject_code,
                room=data.room,
                schedule_days=data.schedule_days or [],
                schedule_start=data.schedule_start,
                schedule_end=data.schedule_end,
                status="active",
            )
            self.db.add(created_assignment)

        await self.db.commit()
        await self.db.refresh(section)
        assignments = await self._get_teaching_assignments_for_section(str(section.id))

        # ✅ Provision the section's group chat - reuses the existing
        # Conversation/ConversationMember tables via SectionConversationService.
        # Never let a chat-provisioning failure block section creation itself.
        try:
            from app.services.section_conversation_service import SectionConversationService
            await SectionConversationService(self.db).get_or_create(str(section.id))
        except Exception:
            logger.exception(f"Failed to auto-provision group chat for new section {section.id}")

        # ✅ If an initial teaching assignment was created above, also
        # provision its own dedicated subject group chat - only after that
        # assignment has actually committed successfully.
        if created_assignment is not None:
            try:
                from app.services.teaching_assignment_conversation_service import TeachingAssignmentConversationService
                await TeachingAssignmentConversationService(self.db).get_or_create(created_assignment)
            except Exception:
                logger.exception(f"Failed to auto-provision subject group chat for assignment {created_assignment.id}")

        return {
            "id": str(section.id),
            "name": section.name,
            "course": section.course,
            "year_level": section.year_level,
            "academic_year": section.academic_year,
            "advisor_id": str(section.advisor_id) if section.advisor_id else None,
            "description": section.description,
            "created_at": section.created_at,
            "updated_at": section.updated_at,
            "member_count": 0,
            "teaching_assignments": assignments,
        }

    async def get_sections(self, user_id: str, skip: int = 0, limit: int = 100):
        """Get all sections for a user"""
        user = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = user.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user.role == "admin":
            result = await self.db.execute(
                select(Section).offset(skip).limit(limit)
            )
            sections = result.scalars().all()
        else:
            # Get sections where user is advisor, a member, or has an active
            # teaching assignment (co-professor)
            result = await self.db.execute(
                select(Section)
                .where(
                    or_(
                        Section.advisor_id == user_id,
                        Section.id.in_(
                            select(SectionMember.section_id).where(
                                SectionMember.user_id == user_id
                            )
                        ),
                        Section.id.in_(
                            select(TeachingAssignment.section_id).where(
                                TeachingAssignment.professor_id == user_id,
                                TeachingAssignment.status == "active",
                            )
                        )
                    )
                )
                .offset(skip).limit(limit)
            )
            sections = result.scalars().all()
        
        response = []
        for section in sections:
            count_result = await self.db.execute(
                select(func.count()).where(SectionMember.section_id == section.id)
            )
            member_count = count_result.scalar()
            
            # Get members for this section
            members_result = await self.db.execute(
                select(SectionMember, User)
                .join(User, SectionMember.user_id == User.id)
                .where(SectionMember.section_id == section.id)
            )
            
            members = []
            for member, user_obj in members_result:
                first_name, last_name = await self._get_profile_names(str(user_obj.id), user_obj.role)
                members.append({
                    "id": str(member.id),
                    "section_id": str(member.section_id),
                    "user_id": str(member.user_id),
                    "role": member.role,
                    "is_officer": member.is_officer,
                    "is_mayor": member.is_mayor,
                    "joined_at": member.joined_at,
                    "user_email": user_obj.email,
                    "user_username": user_obj.username,
                    "user_avatar": await self._get_avatar_url(str(user_obj.id), user_obj.role),
                    "user_first_name": first_name,
                    "user_last_name": last_name,
                })

            response.append({
                "id": str(section.id),
                "name": section.name,
                "course": section.course,
                "year_level": section.year_level,
                "academic_year": section.academic_year,
                "advisor_id": str(section.advisor_id) if section.advisor_id else None,
                "description": section.description,
                "created_at": section.created_at,
                "updated_at": section.updated_at,
                "member_count": member_count or 0,
                "members": members,
                "teaching_assignments": await self._get_teaching_assignments_for_section(str(section.id)),
            })

        return response

    async def browse_sections(
        self, user_id: str, year_level: Optional[int] = None, name: Optional[str] = None
    ):
        """Platform-wide, lightweight section listing for the "Join Existing
        Section" flow - unlike get_sections, this is NOT scoped to the
        requester's own sections, since the whole point is discovering
        sections they're not yet part of."""
        query = select(Section)
        if year_level is not None:
            query = query.where(Section.year_level == year_level)
        if name:
            query = query.where(func.lower(Section.name).contains(name.lower()))

        result = await self.db.execute(query.order_by(Section.name))
        sections = result.scalars().all()

        items = []
        for section in sections:
            member_count_result = await self.db.execute(
                select(func.count()).where(SectionMember.section_id == section.id)
            )
            professor_count_result = await self.db.execute(
                select(func.count(func.distinct(TeachingAssignment.professor_id))).where(
                    TeachingAssignment.section_id == section.id,
                    TeachingAssignment.status == "active",
                )
            )
            already_teaching = await self._is_active_teaching_professor(str(section.id), user_id)

            items.append({
                "id": str(section.id),
                "name": section.name,
                "course": section.course,
                "year_level": section.year_level,
                "academic_year": section.academic_year,
                "member_count": member_count_result.scalar() or 0,
                "professor_count": professor_count_result.scalar() or 0,
                "already_teaching": already_teaching,
            })
        return items

    async def get_section(self, section_id: str, user_id: str):
        """Get a section by ID with member details"""
        section = await self._get_section(section_id)
        await self._check_section_view_access(section, user_id)

        # Get members with user details
        members_result = await self.db.execute(
            select(SectionMember, User)
            .join(User, SectionMember.user_id == User.id)
            .where(SectionMember.section_id == section_id)
        )

        members = []
        for member, user_obj in members_result:
            first_name, last_name = await self._get_profile_names(str(user_obj.id), user_obj.role)
            members.append({
                "id": str(member.id),
                "section_id": str(member.section_id),
                "user_id": str(member.user_id),
                "role": member.role,
                "is_officer": member.is_officer,
                "is_mayor": member.is_mayor,
                "joined_at": member.joined_at,
                "user_email": user_obj.email,
                "user_username": user_obj.username,
                "user_avatar": await self._get_avatar_url(str(user_obj.id), user_obj.role),
                "user_first_name": first_name,
                "user_last_name": last_name,
            })

        return {
            "id": str(section.id),
            "name": section.name,
            "course": section.course,
            "year_level": section.year_level,
            "academic_year": section.academic_year,
            "advisor_id": str(section.advisor_id) if section.advisor_id else None,
            "description": section.description,
            "created_at": section.created_at,
            "updated_at": section.updated_at,
            "member_count": len(members),
            "members": members,
            "teaching_assignments": await self._get_teaching_assignments_for_section(section_id),
        }

    async def update_section(self, section_id: str, data: SectionUpdate, user_id: str):
        """Update a section"""
        section = await self._get_section(section_id)

        user = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = user.scalar_one_or_none()

        is_professor = (
            str(section.advisor_id) == user_id
            or await self._is_active_teaching_professor(section_id, user_id)
        )
        if not is_professor and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this section"
            )
        
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(section, key, value)
        
        await self.db.commit()
        await self.db.refresh(section)
        
        return {
            "id": str(section.id),
            "name": section.name,
            "course": section.course,
            "year_level": section.year_level,
            "academic_year": section.academic_year,
            "advisor_id": str(section.advisor_id) if section.advisor_id else None,
            "description": section.description,
            "created_at": section.created_at,
            "updated_at": section.updated_at,
            "member_count": 0
        }

    async def delete_section(self, section_id: str, user_id: str):
        """Delete a section"""
        section = await self._get_section(section_id)

        user = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = user.scalar_one_or_none()

        is_professor = (
            str(section.advisor_id) == user_id
            or await self._is_active_teaching_professor(section_id, user_id)
        )
        if not is_professor and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this section"
            )

        # Delete every Conversation this section (and its teaching
        # assignments) owns BEFORE deleting the section itself. The DB's own
        # ON DELETE CASCADE on SectionConversation.section_id/
        # TeachingAssignmentConversation.teaching_assignment_id already
        # correctly removes those thin link rows when the section (and its
        # cascaded teaching assignments) are deleted below - but neither FK
        # points the other way, so nothing ever cascades from there to the
        # actual Conversation row. Left alone, that conversation (plus its
        # members/messages, which DO cascade off Conversation itself) simply
        # survives with no owning section - a fully working, orphaned group
        # chat. Deleting the Conversation rows here first closes that gap.
        conversation_ids: set = set()

        section_conv = await self.db.execute(
            select(SectionConversation.conversation_id).where(SectionConversation.section_id == section.id)
        )
        conversation_ids.update(row[0] for row in section_conv.all())

        ta_conv = await self.db.execute(
            select(TeachingAssignmentConversation.conversation_id)
            .join(TeachingAssignment, TeachingAssignment.id == TeachingAssignmentConversation.teaching_assignment_id)
            .where(TeachingAssignment.section_id == section.id)
        )
        conversation_ids.update(row[0] for row in ta_conv.all())

        if conversation_ids:
            # Messages are deleted explicitly rather than left to cascade off
            # the Conversation delete below: unlike ConversationMember
            # (which does cascade correctly), the live messages table's
            # conversation_id foreign key was found to have no ON DELETE
            # CASCADE at all, so relying on it here would silently leave
            # every message behind as dead, unreachable rows. Explicit
            # deletion doesn't depend on that constraint either way.
            # MessageReaction rows do cascade correctly off Message.
            await self.db.execute(sa_delete(Message).where(Message.conversation_id.in_(conversation_ids)))
            await self.db.execute(sa_delete(Conversation).where(Conversation.id.in_(conversation_ids)))

        await self.db.delete(section)
        await self.db.commit()
        return {"message": "Section deleted successfully"}

    # ============================================
    # MEMBER MANAGEMENT
    # ============================================
    
    async def add_member(self, section_id: str, user_id: str, current_user_id: str):
        """Add a member to a section"""
        logger.info(f"📝 Adding member {user_id} to section {section_id}")
        
        section = await self._get_section(section_id)
        logger.info(f"📝 Section found: {section.name}")
        
        # ✅ Check permission using the helper method
        await self._check_section_permission(section_id, current_user_id)
        logger.info(f"✅ Permission granted for user {current_user_id}")
        
        # Check if user exists
        user = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = user.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        logger.info(f"👤 User found: {user.username}")
        
        # Check if already a member
        result = await self.db.execute(
            select(SectionMember).where(
                SectionMember.section_id == section_id,
                SectionMember.user_id == user_id
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this section"
            )
        
        # Create member
        member = SectionMember(
            section_id=section_id,
            user_id=user_id,
            role="student"
        )
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(member)
        logger.info(f"✅ Member added with ID: {member.id}")

        # ✅ Keep the section's group chat in sync - lazily creates it (seeded
        # with every current member) if this section doesn't have one yet.
        try:
            from app.services.section_conversation_service import SectionConversationService
            await SectionConversationService(self.db).get_or_create(section_id, ensure_user_id=user_id)
        except Exception:
            logger.exception(f"Failed to sync group chat membership for user {user_id} joining section {section_id}")

        # ✅ Also add them to every subject group chat already provisioned
        # for this section - mirrors the section-chat sync just above, one
        # level down.
        try:
            from app.services.teaching_assignment_conversation_service import TeachingAssignmentConversationService
            await TeachingAssignmentConversationService(self.db).sync_new_section_member(section_id, user_id)
        except Exception:
            logger.exception(f"Failed to sync subject group chat membership for user {user_id} joining section {section_id}")

        first_name, last_name = await self._get_profile_names(str(user.id), user.role)
        return {
            "id": str(member.id),
            "section_id": str(member.section_id),
            "user_id": str(member.user_id),
            "role": member.role,
            "is_officer": member.is_officer,
            "is_mayor": member.is_mayor,
            "joined_at": member.joined_at,
            "user_email": user.email,
            "user_username": user.username,
            "user_avatar": await self._get_avatar_url(str(user.id), user.role),
            "user_first_name": first_name,
            "user_last_name": last_name,
        }

    async def remove_member(self, section_id: str, user_id: str, current_user_id: str):
        """Remove a member from a section"""
        await self._get_section(section_id)
        await self._check_section_permission(section_id, current_user_id)
        
        result = await self.db.execute(
            select(SectionMember).where(
                SectionMember.section_id == section_id,
                SectionMember.user_id == user_id
            )
        )
        member = result.scalar_one_or_none()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this section"
            )
        
        await self.db.delete(member)
        await self.db.commit()

        try:
            from app.services.section_conversation_service import SectionConversationService
            await SectionConversationService(self.db).remove_member(section_id, user_id)
        except Exception:
            logger.exception(f"Failed to remove user {user_id} from section {section_id}'s group chat")

        try:
            from app.services.teaching_assignment_conversation_service import TeachingAssignmentConversationService
            await TeachingAssignmentConversationService(self.db).remove_section_member(section_id, user_id)
        except Exception:
            logger.exception(f"Failed to remove user {user_id} from section {section_id}'s subject group chats")

        return {"message": "Member removed successfully"}

    # ============================================
    # PROMOTION FEATURES
    # ============================================
    
    async def promote_to_officer(self, section_id: str, user_id: str, current_user_id: str):
        """Promote a student to officer - only one Officer per section at a
        time, and the Mayor (who already has full permissions) can't also be
        made Officer."""
        await self._check_promotion_permission(section_id, current_user_id)

        member = await self._get_member(section_id, user_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User is not a member of this section"
            )

        if member.is_mayor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The Mayor already has full permissions and can't also be made Officer"
            )

        # Only one Officer per section - demote whoever currently holds it.
        existing_officer = await self.db.execute(
            select(SectionMember).where(
                SectionMember.section_id == section_id,
                SectionMember.is_officer == True,
                SectionMember.is_mayor == False,
            )
        )
        existing = existing_officer.scalar_one_or_none()
        if existing and str(existing.id) != str(member.id):
            existing.is_officer = False

        member.is_officer = True
        await self.db.commit()
        await self.db.refresh(member)

        return {"message": "Student promoted to Officer successfully"}

    async def demote_officer(self, section_id: str, user_id: str, current_user_id: str):
        """Demote an officer back to student"""
        await self._check_promotion_permission(section_id, current_user_id)

        member = await self._get_member(section_id, user_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User is not a member of this section"
            )
        
        if not member.is_officer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not an officer"
            )
        
        if member.is_mayor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the Mayor. Demote from Mayor first."
            )
        
        member.is_officer = False
        await self.db.commit()
        
        return {"message": "Officer demoted to Student successfully"}

    async def promote_to_mayor(self, section_id: str, user_id: str, current_user_id: str):
        """Promote a student to class mayor - only one Mayor per section.
        Mayor and Officer are separate, exclusive roles (a Mayor already has
        full permissions via _check_section_permission's is_mayor check, so
        this no longer also flags them as Officer)."""
        await self._check_promotion_permission(section_id, current_user_id)

        member = await self._get_member(section_id, user_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User is not a member of this section"
            )

        # Check if there's already a mayor
        existing_mayor = await self.db.execute(
            select(SectionMember).where(
                SectionMember.section_id == section_id,
                SectionMember.is_mayor == True
            )
        )
        existing = existing_mayor.scalar_one_or_none()

        if existing:
            existing.is_mayor = False
            # Clean up stale data from before Mayor/Officer were made
            # mutually exclusive (a Mayor used to also get is_officer=True).
            existing.is_officer = False

        member.is_mayor = True
        # If they were already the section's Officer, that slot is now free.
        member.is_officer = False

        await self.db.commit()

        return {"message": "Student promoted to Class Mayor successfully"}

    async def demote_mayor(self, section_id: str, user_id: str, current_user_id: str):
        """Demote a mayor back to student"""
        await self._check_promotion_permission(section_id, current_user_id)

        member = await self._get_member(section_id, user_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User is not a member of this section"
            )
        
        if not member.is_mayor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not the Mayor"
            )
        
        member.is_mayor = False
        member.is_officer = False
        await self.db.commit()
        
        return {"message": "Mayor demoted to Student successfully"}