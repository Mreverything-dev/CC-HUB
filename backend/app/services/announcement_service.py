# backend/app/services/announcement_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from fastapi import HTTPException, status
from datetime import datetime

from app.models.announcement import Announcement, AnnouncementTarget
from app.models.user import User
from app.models.section import SectionMember
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate

class AnnouncementService:  # ← Make sure this class exists
    def __init__(self, db: AsyncSession):
        self.db = db

    # ============================================
    # GET USER HELPER METHODS
    # ============================================
    
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

    # ============================================
    # GET ANNOUNCEMENTS (WITH VISIBILITY RULES)
    # ============================================
    
    async def get_announcements(self, user_id: str) -> List[Announcement]:
        """Get announcements based on user role and visibility rules"""
        user = await self.get_user(user_id)
        
        # Get all admin announcements (visible to everyone)
        admin_result = await self.db.execute(
            select(Announcement).where(
                Announcement.created_by_role == "admin",
                Announcement.is_published == True
            ).order_by(Announcement.created_at.desc())
        )
        admin_announcements = admin_result.scalars().all()
        
        # Get professor announcements (only visible to their section students)
        if user.role == "student":
            # Get sections the student is in
            student_sections = await self.get_student_sections(user_id)
            
            if student_sections:
                # Get announcements targeting the student's sections
                prof_result = await self.db.execute(
                    select(Announcement)
                    .join(AnnouncementTarget, AnnouncementTarget.announcement_id == Announcement.id)
                    .where(
                        Announcement.created_by_role == "professor",
                        Announcement.is_published == True,
                        AnnouncementTarget.target_type == "section",
                        AnnouncementTarget.target_id.in_(student_sections)
                    )
                    .distinct()
                    .order_by(Announcement.created_at.desc())
                )
                professor_announcements = prof_result.scalars().all()
            else:
                professor_announcements = []
        else:
            # Professors and admins can see all professor announcements
            prof_result = await self.db.execute(
                select(Announcement).where(
                    Announcement.created_by_role == "professor",
                    Announcement.is_published == True
                ).order_by(Announcement.created_at.desc())
            )
            professor_announcements = prof_result.scalars().all()
        
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
        
        return unique_announcements

    # ============================================
    # CRUD OPERATIONS
    # ============================================
    
    async def create_announcement(self, user_id: str, data: AnnouncementCreate) -> Announcement:
        """Create a new announcement"""
        user = await self.get_user(user_id)
        
        # Only professors and admins can create announcements
        if user.role not in ["professor", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only professors and admins can create announcements"
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
        
        # Add targets if specified
        if data.target_roles or data.target_sections:
            targets = []
            
            # Add role targets
            if data.target_roles:
                for role in data.target_roles:
                    target = AnnouncementTarget(
                        announcement_id=announcement.id,
                        target_type="role",
                        target_id=role
                    )
                    targets.append(target)
            
            # Add section targets
            if data.target_sections:
                for section_id in data.target_sections:
                    target = AnnouncementTarget(
                        announcement_id=announcement.id,
                        target_type="section",
                        target_id=section_id
                    )
                    targets.append(target)
            
            if targets:
                self.db.add_all(targets)
                await self.db.commit()
        
        return announcement

    async def get_announcement(self, announcement_id: str) -> Announcement:
        """Get a single announcement by ID"""
        result = await self.db.execute(
            select(Announcement).where(Announcement.id == announcement_id)
        )
        announcement = result.scalar_one_or_none()
        if not announcement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Announcement not found"
            )
        return announcement

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
        
        return announcement

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