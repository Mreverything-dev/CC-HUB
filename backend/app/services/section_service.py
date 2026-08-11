# backend/app/services/section_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.models.section import Section, SectionMember
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

    # ============================================
    # SECTION CRUD
    # ============================================
    
    async def create_section(self, data: SectionCreate, user_id: str):
        """Create a new section"""
        section = Section(
            name=data.name,
            course=data.course,
            year_level=data.year_level,
            academic_year=data.academic_year,
            description=data.description,
            advisor_id=user_id
        )
        self.db.add(section)
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
            # Get sections where user is advisor or member
            result = await self.db.execute(
                select(Section)
                .where(
                    or_(
                        Section.advisor_id == user_id,
                        Section.id.in_(
                            select(SectionMember.section_id).where(
                                SectionMember.user_id == user_id
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
                    "user_avatar": await self._get_avatar_url(str(user_obj.id), user_obj.role)
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
                "members": members
            })
        
        return response

    async def get_section(self, section_id: str, user_id: str):
        """Get a section by ID with member details"""
        section = await self._get_section(section_id)
        
        # Get members with user details
        members_result = await self.db.execute(
            select(SectionMember, User)
            .join(User, SectionMember.user_id == User.id)
            .where(SectionMember.section_id == section_id)
        )
        
        members = []
        for member, user_obj in members_result:
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
                "user_avatar": await self._get_avatar_url(str(user_obj.id), user_obj.role)
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
            "members": members
        }

    async def update_section(self, section_id: str, data: SectionUpdate, user_id: str):
        """Update a section"""
        section = await self._get_section(section_id)
        
        user = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = user.scalar_one_or_none()
        
        if str(section.advisor_id) != user_id and user.role != "admin":
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
        
        if str(section.advisor_id) != user_id and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this section"
            )
        
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
            "user_avatar": await self._get_avatar_url(str(user.id), user.role)
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
        return {"message": "Member removed successfully"}

    # ============================================
    # PROMOTION FEATURES
    # ============================================
    
    async def promote_to_officer(self, section_id: str, user_id: str, current_user_id: str):
        """Promote a student to officer"""
        await self._check_section_permission(section_id, current_user_id)
        
        member = await self._get_member(section_id, user_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User is not a member of this section"
            )
        
        member.is_officer = True
        await self.db.commit()
        await self.db.refresh(member)
        
        return {"message": "Student promoted to Officer successfully"}

    async def demote_officer(self, section_id: str, user_id: str, current_user_id: str):
        """Demote an officer back to student"""
        await self._check_section_permission(section_id, current_user_id)
        
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
        """Promote a student to class mayor"""
        await self._check_section_permission(section_id, current_user_id)
        
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
            existing.is_officer = False
        
        member.is_mayor = True
        member.is_officer = True
        
        await self.db.commit()
        
        return {"message": "Student promoted to Class Mayor successfully"}

    async def demote_mayor(self, section_id: str, user_id: str, current_user_id: str):
        """Demote a mayor back to student"""
        await self._check_section_permission(section_id, current_user_id)
        
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