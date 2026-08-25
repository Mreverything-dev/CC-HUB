# backend/app/services/livestream_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from app.models.livestream import Livestream, StreamViewer, StreamStatus, StreamVisibility
from app.models.user import User
from app.models.friend import Friend
from app.models.section import Section, SectionMember
from app.models.teaching_assignment import TeachingAssignment
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.schemas.livestream import LivestreamCreate, LivestreamUpdate
from fastapi import HTTPException, status
from typing import List, Optional
from datetime import datetime
import uuid
import secrets
import logging

logger = logging.getLogger(__name__)

class LivestreamService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_avatar_url(self, user_id: str, role: str) -> Optional[str]:
        """Get a user's avatar URL from their role-specific profile - same
        lookup used by post_service/chat_service/announcement_service/etc,
        duplicated here rather than shared since every one of those services
        already keeps its own copy of this exact helper."""
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

    async def create_stream(self, user_id: str, data: LivestreamCreate) -> Livestream:
        """Create a new livestream"""
        user = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = user.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Validate section visibility for professors
        if user.role == "professor" and data.visibility == StreamVisibility.SECTION:
            if not data.target_section_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Section IDs required for section visibility"
                )
            
            # Verify professor is the advisor OR has an active teaching
            # assignment (co-professor) on the section
            for section_id in data.target_section_ids:
                result = await self.db.execute(
                    select(Section).where(
                        Section.id == section_id,
                        or_(
                            Section.advisor_id == user_id,
                            Section.id.in_(
                                select(TeachingAssignment.section_id).where(
                                    TeachingAssignment.section_id == section_id,
                                    TeachingAssignment.professor_id == user_id,
                                    TeachingAssignment.status == "active",
                                )
                            ),
                        ),
                    )
                )
                if not result.scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"You don't own section {section_id}"
                    )
        
        # Generate stream key
        stream_key = secrets.token_urlsafe(32)
        
        stream = Livestream(
            host_id=user_id,
            title=data.title,
            description=data.description,
            visibility=data.visibility,
            target_section_ids=data.target_section_ids or [],
            thumbnail_url=data.thumbnail_url,
            stream_key=stream_key,
            status=StreamStatus.SCHEDULED
        )
        
        self.db.add(stream)
        await self.db.commit()
        await self.db.refresh(stream)
        
        return stream

    async def get_streams(self, user_id: str, status_filter: Optional[str] = None) -> List[Livestream]:
        """Get streams the user can view"""
        user = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = user.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Base query
        query = select(Livestream).options(selectinload(Livestream.host))

        if status_filter:
            query = query.where(Livestream.status == status_filter)

        # Only show LIVE streams by default
        if not status_filter:
            query = query.where(Livestream.status == StreamStatus.LIVE)
        
        streams = await self.db.execute(query)
        streams = streams.scalars().all()
        
        # Filter by visibility
        visible_streams = []
        for stream in streams:
            if await self.can_view_stream(user_id, stream.id):
                visible_streams.append(stream)
        
        return visible_streams

    async def get_stream(self, stream_id: str, user_id: str) -> Livestream:
        """Get a single stream with permission check"""
        result = await self.db.execute(
            select(Livestream)
            .options(selectinload(Livestream.host))
            .where(Livestream.id == stream_id)
        )
        stream = result.scalar_one_or_none()
        
        if not stream:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stream not found"
            )
        
        if not await self.can_view_stream(user_id, stream_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view this stream"
            )
        
        return stream

    async def update_stream(self, stream_id: str, user_id: str, data: LivestreamUpdate) -> Livestream:
        """Update a stream"""
        stream = await self.get_stream(stream_id, user_id)
        
        if str(stream.host_id) != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the host can update this stream"
            )
        
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(stream, key, value)
        
        stream.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(stream)
        
        return stream

    async def start_stream(self, stream_id: str, user_id: str) -> Livestream:
        """Start a livestream"""
        stream = await self.get_stream(stream_id, user_id)
        
        if str(stream.host_id) != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the host can start this stream"
            )
        
        stream.status = StreamStatus.LIVE
        stream.started_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(stream)
        
        return stream

    async def end_stream(self, stream_id: str, user_id: str) -> Livestream:
        """End a livestream"""
        stream = await self.get_stream(stream_id, user_id)
        
        if str(stream.host_id) != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the host can end this stream"
            )
        
        stream.status = StreamStatus.ENDED
        stream.ended_at = datetime.utcnow()
        
        # Mark all viewers as inactive
        await self.db.execute(
            update(StreamViewer)
            .where(StreamViewer.stream_id == stream_id)
            .values(left_at=datetime.utcnow(), is_active=False)
        )
        stream.viewer_count = 0
        
        await self.db.commit()
        await self.db.refresh(stream)
        
        return stream

    async def can_view_stream(self, user_id: str, stream_id: str) -> bool:
        """Check if a user can view a stream"""
        result = await self.db.execute(
            select(Livestream)
            .options(selectinload(Livestream.host))
            .where(Livestream.id == stream_id)
        )
        stream = result.scalar_one_or_none()
        
        if not stream:
            return False
        
        # Host can always view
        if str(stream.host_id) == user_id:
            return True
        
        # Check visibility
        if stream.visibility == StreamVisibility.PUBLIC:
            return True
        
        elif stream.visibility == StreamVisibility.FRIENDS:
            # Check if users are friends. The Friend table stores one row per
            # direction once a friendship is accepted, so this can legitimately
            # match two rows - just check whether any row exists.
            friend_result = await self.db.execute(
                select(func.count()).select_from(Friend).where(
                    or_(
                        and_(
                            Friend.user_id == user_id,
                            Friend.friend_id == stream.host_id
                        ),
                        and_(
                            Friend.user_id == stream.host_id,
                            Friend.friend_id == user_id
                        )
                    )
                )
            )
            return friend_result.scalar() > 0
        
        elif stream.visibility == StreamVisibility.SECTION:
            # Get user's sections
            section_result = await self.db.execute(
                select(SectionMember.section_id).where(
                    SectionMember.user_id == user_id
                )
            )
            user_sections = [str(s) for s in section_result.scalars().all()]
            
            # Check if user belongs to any target section
            target_sections = [str(s) for s in stream.target_section_ids]
            return any(s in user_sections for s in target_sections)
        
        return False

    async def add_viewer(self, stream_id: str, user_id: str) -> dict:
        """Add a viewer to a stream"""
        # Check permission
        if not await self.can_view_stream(user_id, stream_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view this stream"
            )
        
        try:
            result = await self.db.execute(
                select(StreamViewer)
                .where(
                    StreamViewer.stream_id == stream_id,
                    StreamViewer.user_id == user_id,
                    StreamViewer.is_active == True
                )
                .order_by(StreamViewer.joined_at.asc(), StreamViewer.id.asc())
            )
            active_viewers = result.scalars().all()

            if active_viewers:
                primary_viewer = active_viewers[0]
                duplicate_viewers = active_viewers[1:]

                if duplicate_viewers:
                    for duplicate in duplicate_viewers:
                        duplicate.is_active = False
                        duplicate.left_at = duplicate.left_at or primary_viewer.joined_at

                    await self.db.execute(
                        update(Livestream)
                        .where(Livestream.id == stream_id)
                        .values(viewer_count=func.greatest(func.coalesce(Livestream.viewer_count, 0) - len(duplicate_viewers), 0))
                    )
                    await self.db.flush()

                await self.db.commit()
                return {"joined": True}

            viewer = StreamViewer(
                stream_id=stream_id,
                user_id=user_id
            )
            self.db.add(viewer)

            # Increment viewer count only for a new active viewer row.
            await self.db.execute(
                update(Livestream)
                .where(Livestream.id == stream_id)
                .values(viewer_count=Livestream.viewer_count + 1)
            )

            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            # A concurrent join may have inserted the active row first; treat
            # that as a successful join and avoid double-counting.
            recovery = await self.db.execute(
                select(StreamViewer).where(
                    StreamViewer.stream_id == stream_id,
                    StreamViewer.user_id == user_id,
                    StreamViewer.is_active == True
                )
            )
            if recovery.scalar_one_or_none():
                return {"joined": True}
            raise
        return {"joined": True}

    async def remove_viewer(self, stream_id: str, user_id: str) -> dict:
        """Remove a viewer from a stream"""
        result = await self.db.execute(
            select(StreamViewer).where(
                StreamViewer.stream_id == stream_id,
                StreamViewer.user_id == user_id,
                StreamViewer.is_active == True
            ).order_by(StreamViewer.joined_at.asc(), StreamViewer.id.asc())
        )
        active_viewers = result.scalars().all()

        if active_viewers:
            viewer = active_viewers[0]
            duplicates = active_viewers[1:]
            viewer.is_active = False
            viewer.left_at = datetime.utcnow()

            for duplicate in duplicates:
                duplicate.is_active = False
                duplicate.left_at = duplicate.left_at or viewer.left_at

            decrement_by = 1 + len(duplicates)
            await self.db.execute(
                update(Livestream)
                .where(Livestream.id == stream_id)
                .values(viewer_count=func.greatest(func.coalesce(Livestream.viewer_count, 0) - decrement_by, 0))
            )
            await self.db.commit()
        
        return {"left": True}

    async def get_viewers(self, stream_id: str, user_id: str) -> List[StreamViewer]:
        """Get active viewers of a stream"""
        await self.get_stream(stream_id, user_id)
        
        result = await self.db.execute(
            select(StreamViewer)
            .options(selectinload(StreamViewer.user))
            .where(
                StreamViewer.stream_id == stream_id,
                StreamViewer.is_active == True
            )
        )
        return result.scalars().all()
