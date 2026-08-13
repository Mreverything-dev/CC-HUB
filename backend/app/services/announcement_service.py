# backend/app/services/announcement_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from fastapi import HTTPException, status
from datetime import datetime
import logging
import uuid

from app.models.announcement import Announcement, AnnouncementTarget, AnnouncementReaction, AnnouncementBookmark
from app.models.user import User
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.models.section import Section, SectionMember
from app.models.notification import Notification
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate

ALLOWED_REACTIONS = {"❤️", "😂", "🔥", "👍", "😮", "😢", "🚀"}

logger = logging.getLogger(__name__)

class AnnouncementService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ============================================
    # GET USER HELPER METHODS
    # ============================================
    
    async def _get_avatar_url(self, user_id: str, role: str) -> Optional[str]:
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

    async def _enrich(self, announcement: Announcement, viewer_id: str) -> Announcement:
        """Attach display-only fields required by AnnouncementResponse that
        aren't real columns: author display info, resolved section names/
        audience label, reactions, and whether the viewer has bookmarked it."""
        announcement.created_by_username = announcement.user.username if announcement.user else None
        announcement.created_by_avatar = (
            await self._get_avatar_url(str(announcement.user_id), announcement.user.role)
            if announcement.user else None
        )

        section_target_ids = [t.target_id for t in (announcement.targets or []) if t.target_type == "section"]
        if section_target_ids:
            section_result = await self.db.execute(
                select(Section.name).where(Section.id.in_(section_target_ids))
            )
            names = list(section_result.scalars().all())
            announcement.target_section_names = names
            announcement.audience = ", ".join(names) if names else "Public"
        else:
            announcement.target_section_names = []
            announcement.audience = "Public"

        reaction_result = await self.db.execute(
            select(AnnouncementReaction).where(AnnouncementReaction.announcement_id == announcement.id)
        )
        announcement.reactions = [
            {"user_id": str(r.user_id), "reaction": r.reaction} for r in reaction_result.scalars().all()
        ]

        bookmark_result = await self.db.execute(
            select(AnnouncementBookmark).where(
                AnnouncementBookmark.announcement_id == announcement.id,
                AnnouncementBookmark.user_id == viewer_id,
            )
        )
        announcement.is_bookmarked = bookmark_result.scalar_one_or_none() is not None

        return announcement

    async def _can_view(self, user: User, announcement: Announcement) -> bool:
        """Same visibility rules already applied by get_announcements' role-based
        queries, but evaluable against a single already-loaded announcement so
        GET /announcements/{id} can enforce them too instead of trusting the
        client to only ever request IDs it saw in its own feed."""
        # Owner and admins can always view (including their own drafts).
        if str(announcement.user_id) == str(user.id) or user.role == "admin":
            return True

        if not announcement.is_published:
            return False

        if announcement.created_by_role == "admin":
            return True

        # Professor-authored announcement.
        if user.role in ("professor", "admin"):
            return True

        if user.role == "student":
            section_target_ids = [t.target_id for t in (announcement.targets or []) if t.target_type == "section"]
            if not section_target_ids:
                # No section-specific targeting => visible to every student.
                return True
            student_sections = await self.get_student_sections(str(user.id))
            return any(sid in student_sections for sid in section_target_ids)

        return False

    async def get_user(self, user_id: str) -> User:
        """Get user by ID"""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user

    async def get_student_sections(self, user_id: str) -> List[str]:
        """Get all section IDs a student is a member of"""
        result = await self.db.execute(
            select(SectionMember.section_id).where(
                SectionMember.user_id == user_id
            )
        )
        sections = result.scalars().all()
        return [str(section) for section in sections]

    async def get_officer_sections(self, user_id: str) -> List[str]:
        """Get section IDs where the user holds a mayor/officer position -
        the only sections a non-professor/admin is allowed to post to."""
        result = await self.db.execute(
            select(SectionMember.section_id).where(
                SectionMember.user_id == user_id,
                or_(SectionMember.is_mayor == True, SectionMember.is_officer == True)
            )
        )
        sections = result.scalars().all()
        return [str(section) for section in sections]

    async def get_professor_sections(self, user_id: str) -> List[dict]:
        """Get all sections where user is the advisor (professor) with details"""
        result = await self.db.execute(
            select(Section).where(Section.advisor_id == user_id)
        )
        sections = result.scalars().all()
        
        # ✅ Fixed: Use query to count members instead of accessing .members directly
        section_list = []
        for section in sections:
            # Count members
            member_count_result = await self.db.execute(
                select(func.count()).where(SectionMember.section_id == section.id)
            )
            member_count = member_count_result.scalar()
            
            section_list.append({
                "id": str(section.id),
                "name": section.name,
                "course": section.course,
                "year_level": section.year_level,
                "member_count": member_count or 0
            })
        
        return section_list

    # ============================================
    # GET ANNOUNCEMENTS (WITH VISIBILITY RULES)
    # ============================================
    
    async def get_announcements(self, user_id: str) -> List[Announcement]:
        """Get announcements based on user role and visibility rules"""
        logger.info(f"📢 Fetching announcements for user: {user_id}")
        
        user = await self.get_user(user_id)
        logger.info(f"📢 User role: {user.role}")
        
        # Get all admin announcements (visible to everyone)
        admin_result = await self.db.execute(
            select(Announcement)
            .options(selectinload(Announcement.targets), selectinload(Announcement.user))
            .where(
                Announcement.created_by_role == "admin",
                Announcement.is_published == True
            )
            .order_by(Announcement.created_at.desc())
        )
        admin_announcements = admin_result.scalars().all()
        logger.info(f"📢 Found {len(admin_announcements)} admin announcements")

        # Get professor announcements
        professor_announcements = []
        
        if user.role == "student":
            student_sections = await self.get_student_sections(user_id)
            logger.info(f"📢 Student sections: {student_sections}")
            
            if student_sections:
                prof_result = await self.db.execute(
                    select(Announcement)
                    .options(selectinload(Announcement.targets), selectinload(Announcement.user))
                    .outerjoin(AnnouncementTarget, AnnouncementTarget.announcement_id == Announcement.id)
                    .where(
                        Announcement.created_by_role == "professor",
                        Announcement.is_published == True,
                        or_(
                            # Announcement targets a specific section
                            and_(
                                AnnouncementTarget.target_type == "section",
                                AnnouncementTarget.target_id.in_(student_sections)
                            ),
                            # Announcement targets "all" (no specific target)
                            and_(
                                AnnouncementTarget.target_type.is_(None),
                                AnnouncementTarget.target_id.is_(None)
                            ),
                            # Announcement has no targets (targets all sections)
                            ~Announcement.id.in_(
                                select(AnnouncementTarget.announcement_id)
                            )
                        )
                    )
                    .distinct()
                    .order_by(Announcement.created_at.desc())
                )
                professor_announcements = prof_result.scalars().all()
                logger.info(f"📢 Found {len(professor_announcements)} professor announcements for student")
            else:
                logger.info(f"📢 Student has no sections")
                professor_announcements = []
        else:
            # Professors and admins can see all professor announcements
            prof_result = await self.db.execute(
                select(Announcement)
                .options(selectinload(Announcement.targets), selectinload(Announcement.user))
                .where(
                    Announcement.created_by_role == "professor",
                    Announcement.is_published == True
                )
                .order_by(Announcement.created_at.desc())
            )
            professor_announcements = prof_result.scalars().all()
            logger.info(f"📢 Found {len(professor_announcements)} professor announcements")

        # Combine and return unique announcements
        all_announcements = list(admin_announcements) + list(professor_announcements)
        
        # Remove duplicates by id
        seen = set()
        unique_announcements = []
        for ann in all_announcements:
            if str(ann.id) not in seen:
                seen.add(str(ann.id))
                unique_announcements.append(ann)
        
        # Sort by created_at (newest first)
        unique_announcements.sort(key=lambda x: x.created_at, reverse=True)

        for ann in unique_announcements:
            await self._enrich(ann, user_id)

        logger.info(f"📢 Total unique announcements: {len(unique_announcements)}")
        return unique_announcements

    # ============================================
    # CRUD OPERATIONS
    # ============================================
    
    async def create_announcement(self, user_id: str, data: AnnouncementCreate) -> Announcement:
        """Create a new announcement with section targeting"""
        logger.info(f"📝 Creating announcement for user: {user_id}")
        
        user = await self.get_user(user_id)

        # Professors and admins can always post. Everyone else (students) may
        # only post if they hold a mayor/officer position in at least one
        # section - and even then, only to the section(s) they officiate.
        officer_section_ids: List[str] = []
        if user.role not in ["professor", "admin"]:
            officer_section_ids = await self.get_officer_sections(user_id)
            if not officer_section_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only professors, admins, and section mayors/officers can create announcements"
                )

        # For professors, validate they have sections
        if user.role == "professor":
            professor_sections = await self.get_professor_sections(user_id)
            if not professor_sections:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You don't have any sections to post announcements to"
                )
        
        # Create announcement
        announcement = Announcement(
            user_id=user_id,
            title=data.title,
            content=data.content,
            image_url=data.image_url,
            type=data.type,
            priority=data.priority,
            created_by_role=user.role,
            is_published=data.is_published,
            expires_at=data.expires_at
        )
        
        self.db.add(announcement)
        await self.db.commit()
        await self.db.refresh(announcement)
        logger.info(f"📝 Announcement created with ID: {announcement.id}")
        
        # ============================================
        # CREATE TARGETS BASED ON ROLE
        # ============================================
        
        if user.role == "admin":
            # Admin announcements target everyone
            logger.info("📝 Admin announcement - targeting everyone")
            target = AnnouncementTarget(
                announcement_id=announcement.id,
                target_type="all",
                target_id="all"
            )
            self.db.add(target)
            await self.db.commit()
            
        elif user.role == "professor":
            # Get professor's sections
            professor_sections = await self.get_professor_sections(user_id)
            section_ids = [s["id"] for s in professor_sections]
            logger.info(f"📝 Professor sections: {section_ids}")
            
            # Determine which sections to target
            target_section_ids = []
            
            # If target_sections is provided, use those (filtered to professor's sections)
            if data.target_sections:
                target_section_ids = [
                    sid for sid in data.target_sections 
                    if sid in section_ids
                ]
                logger.info(f"📝 Targeting selected sections: {target_section_ids}")
            else:
                # If no sections specified, target ALL professor sections
                target_section_ids = section_ids
                logger.info(f"📝 Targeting all professor sections: {target_section_ids}")
            
            # Create targets for each section
            if target_section_ids:
                for section_id in target_section_ids:
                    target = AnnouncementTarget(
                        announcement_id=announcement.id,
                        target_type="section",
                        target_id=section_id
                    )
                    self.db.add(target)
                    logger.info(f"📝 Added target for section: {section_id}")

                await self.db.commit()
            else:
                logger.warning("⚠️ No sections targeted for this announcement")

        else:
            # Mayor/officer - always scoped to the section(s) they officiate,
            # never public/CCS-wide even if target_sections is omitted.
            target_section_ids = [
                sid for sid in (data.target_sections or officer_section_ids)
                if sid in officer_section_ids
            ] or officer_section_ids
            logger.info(f"📝 Mayor/officer targeting sections: {target_section_ids}")

            for section_id in target_section_ids:
                target = AnnouncementTarget(
                    announcement_id=announcement.id,
                    target_type="section",
                    target_id=section_id
                )
                self.db.add(target)
            await self.db.commit()

        # ============================================
        # EAGERLY LOAD TARGETS BEFORE RETURNING
        # ============================================
        await self.db.refresh(announcement)

        result = await self.db.execute(
            select(Announcement)
            .options(selectinload(Announcement.targets), selectinload(Announcement.user))
            .where(Announcement.id == announcement.id)
        )
        announcement = result.scalar_one()

        logger.info(f"📝 Announcement created with {len(announcement.targets) if announcement.targets else 0} targets")

        if announcement.is_published:
            await self._notify_new_announcement(announcement, user)

        return await self._enrich(announcement, user_id)

    async def _notify_new_announcement(self, announcement: Announcement, author: User):
        """Notify everyone the announcement targets (DB row + realtime WS
        push), mirroring FriendService.create_notification's pattern."""
        from app.websocket.manager import manager

        target_types = {t.target_type for t in (announcement.targets or [])}
        if "all" in target_types:
            result = await self.db.execute(select(User.id).where(User.id != author.id))
            recipient_ids = {str(uid) for uid in result.scalars().all()}
        else:
            section_ids = [t.target_id for t in (announcement.targets or []) if t.target_type == "section"]
            if not section_ids:
                return
            result = await self.db.execute(
                select(SectionMember.user_id).where(
                    SectionMember.section_id.in_(section_ids),
                    SectionMember.user_id != author.id
                )
            )
            recipient_ids = {str(uid) for uid in result.scalars().all()}

        if not recipient_ids:
            return

        author_avatar = await self._get_avatar_url(str(author.id), author.role)
        title = "New Announcement"
        content = f"{author.username} posted: {announcement.title}"
        notif_data = {
            "announcement_id": str(announcement.id),
            "actor_id": str(author.id),
            "actor_name": author.username,
            "actor_avatar": author_avatar,
        }

        recipients_with_ids = [(recipient_id, uuid.uuid4()) for recipient_id in recipient_ids]
        for recipient_id, notif_id in recipients_with_ids:
            self.db.add(Notification(
                id=notif_id,
                user_id=recipient_id,
                type="announcement",
                title=title,
                content=content,
                data=notif_data,
            ))
        await self.db.commit()

        created_at_iso = datetime.utcnow().isoformat()
        for recipient_id, notif_id in recipients_with_ids:
            await manager.send_to_user(
                user_id=recipient_id,
                event="new_notification",
                data={
                    "id": str(notif_id),
                    "type": "announcement",
                    "title": title,
                    "content": content,
                    "data": notif_data,
                    "created_at": created_at_iso,
                },
            )

    async def get_announcement(self, announcement_id: str, viewer_id: str) -> Announcement:
        """Get a single announcement by ID - enforces the same visibility
        rules as the feed (get_announcements), so a user can't view an
        announcement just by knowing/guessing its ID."""
        result = await self.db.execute(
            select(Announcement)
            .options(selectinload(Announcement.targets), selectinload(Announcement.user))
            .where(Announcement.id == announcement_id)
        )
        announcement = result.scalar_one_or_none()
        if not announcement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Announcement not found"
            )

        viewer = await self.get_user(viewer_id)
        if not await self._can_view(viewer, announcement):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view this announcement"
            )

        return await self._enrich(announcement, viewer_id)

    async def update_announcement(
        self,
        announcement_id: str,
        user_id: str,
        data: AnnouncementUpdate
    ) -> Announcement:
        """Update an announcement"""
        announcement = await self.get_announcement(announcement_id, user_id)
        
        # Check if user is the creator or admin
        if str(announcement.user_id) != user_id:
            user = await self.get_user(user_id)
            if user.role != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have permission to update this announcement"
                )
        
        # Update fields
        for key, value in data.model_dump(exclude_unset=True).items():
            if key not in ["target_roles", "target_sections"]:
                setattr(announcement, key, value)
        
        announcement.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(announcement)
        
        # Update targets if provided
        if data.target_sections is not None:
            # Remove existing targets
            await self.db.execute(
                AnnouncementTarget.__table__.delete().where(
                    AnnouncementTarget.announcement_id == announcement_id
                )
            )
            
            # Add new targets
            for section_id in data.target_sections:
                target = AnnouncementTarget(
                    announcement_id=announcement.id,
                    target_type="section",
                    target_id=section_id
                )
                self.db.add(target)
            
            await self.db.commit()
            await self.db.refresh(announcement)
        
        # Eagerly load targets
        result = await self.db.execute(
            select(Announcement)
            .options(selectinload(Announcement.targets), selectinload(Announcement.user))
            .where(Announcement.id == announcement.id)
        )
        announcement = result.scalar_one()

        return await self._enrich(announcement, user_id)

    async def delete_announcement(self, announcement_id: str, user_id: str) -> dict:
        """Delete an announcement"""
        announcement = await self.get_announcement(announcement_id, user_id)
        
        # Check if user is the creator or admin
        if str(announcement.user_id) != user_id:
            user = await self.get_user(user_id)
            if user.role != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have permission to delete this announcement"
                )
        
        await self.db.delete(announcement)
        await self.db.commit()
        
        return {"message": "Announcement deleted successfully"}

    async def toggle_publish_status(
        self, 
        announcement_id: str, 
        user_id: str, 
        is_published: bool
    ) -> dict:
        """Toggle publish status of an announcement"""
        announcement = await self.get_announcement(announcement_id, user_id)
        
        # Check if user is the creator or admin
        if str(announcement.user_id) != user_id:
            user = await self.get_user(user_id)
            if user.role != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have permission to modify this announcement"
                )
        
        announcement.is_published = is_published
        announcement.updated_at = datetime.utcnow()
        await self.db.commit()
        
        status_text = "published" if is_published else "unpublished"
        return {"message": f"Announcement {status_text} successfully"}

    # ============================================
    # REACTIONS & BOOKMARKS
    # ============================================

    async def _get_viewable_announcement(self, announcement_id: str, user_id: str) -> Announcement:
        result = await self.db.execute(
            select(Announcement)
            .options(selectinload(Announcement.targets))
            .where(Announcement.id == announcement_id)
        )
        announcement = result.scalar_one_or_none()
        if not announcement:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

        user = await self.get_user(user_id)
        if not await self._can_view(user, announcement):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this announcement",
            )
        return announcement

    async def react_to_announcement(self, announcement_id: str, user_id: str, reaction: str) -> dict:
        """Add/change/remove the caller's reaction. Same reaction twice removes
        it; a different reaction replaces it - mirrors the livestream comment
        reaction behavior for consistency, without touching that system."""
        if reaction not in ALLOWED_REACTIONS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported reaction")

        await self._get_viewable_announcement(announcement_id, user_id)

        existing_result = await self.db.execute(
            select(AnnouncementReaction).where(
                AnnouncementReaction.announcement_id == announcement_id,
                AnnouncementReaction.user_id == user_id,
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
            self.db.add(AnnouncementReaction(announcement_id=announcement_id, user_id=user_id, reaction=reaction))
            new_reaction = reaction

        await self.db.commit()

        reaction_result = await self.db.execute(
            select(AnnouncementReaction).where(AnnouncementReaction.announcement_id == announcement_id)
        )
        return {
            "announcement_id": str(announcement_id),
            "user_id": str(user_id),
            "reaction": new_reaction,
            "reactions": [
                {"user_id": str(r.user_id), "reaction": r.reaction} for r in reaction_result.scalars().all()
            ],
        }

    async def toggle_bookmark(self, announcement_id: str, user_id: str) -> dict:
        """Save/unsave an announcement for the current user."""
        await self._get_viewable_announcement(announcement_id, user_id)

        existing_result = await self.db.execute(
            select(AnnouncementBookmark).where(
                AnnouncementBookmark.announcement_id == announcement_id,
                AnnouncementBookmark.user_id == user_id,
            )
        )
        existing = existing_result.scalar_one_or_none()

        if existing:
            await self.db.delete(existing)
            await self.db.commit()
            return {"announcement_id": str(announcement_id), "is_bookmarked": False}

        self.db.add(AnnouncementBookmark(announcement_id=announcement_id, user_id=user_id))
        await self.db.commit()
        return {"announcement_id": str(announcement_id), "is_bookmarked": True}