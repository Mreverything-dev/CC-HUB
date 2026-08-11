# backend/app/services/announcement_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from fastapi import HTTPException, status
from datetime import datetime
import logging

from app.models.announcement import Announcement, AnnouncementTarget
from app.models.user import User
from app.models.section import Section, SectionMember
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate

logger = logging.getLogger(__name__)

class AnnouncementService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ============================================
    # GET USER HELPER METHODS
    # ============================================
    
    def _attach_author_username(self, announcement: Announcement) -> Announcement:
        """Attach the author's username - required by AnnouncementResponse but not a real column"""
        announcement.created_by_username = announcement.user.username if announcement.user else None
        return announcement

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
            self._attach_author_username(ann)

        logger.info(f"📢 Total unique announcements: {len(unique_announcements)}")
        return unique_announcements

    # ============================================
    # CRUD OPERATIONS
    # ============================================
    
    async def create_announcement(self, user_id: str, data: AnnouncementCreate) -> Announcement:
        """Create a new announcement with section targeting"""
        logger.info(f"📝 Creating announcement for user: {user_id}")
        
        user = await self.get_user(user_id)
        
        # Only professors and admins can create announcements
        if user.role not in ["professor", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only professors and admins can create announcements"
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
        return self._attach_author_username(announcement)

    async def get_announcement(self, announcement_id: str) -> Announcement:
        """Get a single announcement by ID"""
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
        return self._attach_author_username(announcement)

    async def update_announcement(
        self, 
        announcement_id: str, 
        user_id: str, 
        data: AnnouncementUpdate
    ) -> Announcement:
        """Update an announcement"""
        announcement = await self.get_announcement(announcement_id)
        
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

        return self._attach_author_username(announcement)

    async def delete_announcement(self, announcement_id: str, user_id: str) -> dict:
        """Delete an announcement"""
        announcement = await self.get_announcement(announcement_id)
        
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
        announcement = await self.get_announcement(announcement_id)
        
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