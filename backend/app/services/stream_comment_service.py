# backend/app/services/stream_comment_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime
import logging

from app.models.livestream import Livestream, StreamComment, StreamCommentReaction
from app.models.user import User
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.services.livestream_service import LivestreamService
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

ALLOWED_REACTIONS = {"❤️", "👍", "😂", "😮", "😢"}


class StreamCommentService:
    """Live-chat comments for a stream: persistence, replies, reactions, and
    delete authorization. Reuses LivestreamService.can_view_stream for the
    same visibility rules already enforced for watching/joining a stream -
    a comment is only accessible to whoever can access the stream itself."""

    def __init__(self, db: AsyncSession):
        self.db = db

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

    async def _get_stream(self, stream_id: str) -> Livestream:
        result = await self.db.execute(select(Livestream).where(Livestream.id == stream_id))
        stream = result.scalar_one_or_none()
        if not stream:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
        return stream

    async def _require_access(self, user_id: str, stream_id: str) -> Livestream:
        stream = await self._get_stream(stream_id)
        service = LivestreamService(self.db)
        if not await service.can_view_stream(user_id, stream_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this stream",
            )
        return stream

    async def _serialize(self, comment: StreamComment, user: Optional[User]) -> dict:
        reaction_result = await self.db.execute(
            select(StreamCommentReaction).where(StreamCommentReaction.comment_id == comment.id)
        )
        reactions = reaction_result.scalars().all()
        return {
            "id": str(comment.id),
            "stream_id": str(comment.stream_id),
            "user_id": str(comment.user_id),
            "username": user.username if user else "Unknown",
            "avatar": await self._get_avatar_url(str(comment.user_id), user.role) if user else None,
            "message": comment.content,
            "parent_comment_id": str(comment.parent_comment_id) if comment.parent_comment_id else None,
            "is_deleted": comment.is_deleted,
            "timestamp": comment.created_at.isoformat(),
            "reactions": [{"user_id": str(r.user_id), "reaction": r.reaction} for r in reactions],
        }

    async def create_comment(
        self, stream_id: str, user_id: str, content: str, parent_comment_id: Optional[str] = None
    ) -> dict:
        await self._require_access(user_id, stream_id)

        if parent_comment_id:
            parent_result = await self.db.execute(
                select(StreamComment).where(StreamComment.id == parent_comment_id)
            )
            parent = parent_result.scalar_one_or_none()
            if not parent or str(parent.stream_id) != str(stream_id) or parent.is_deleted:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The comment you're replying to no longer exists",
                )

        comment = StreamComment(
            stream_id=stream_id,
            user_id=user_id,
            parent_comment_id=parent_comment_id,
            content=content,
        )
        self.db.add(comment)
        await self.db.commit()
        await self.db.refresh(comment)

        user_result = await self.db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        return await self._serialize(comment, user)

    async def react_to_comment(self, comment_id: str, user_id: str, reaction: str) -> dict:
        if reaction not in ALLOWED_REACTIONS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported reaction")

        comment_result = await self.db.execute(select(StreamComment).where(StreamComment.id == comment_id))
        comment = comment_result.scalar_one_or_none()
        if not comment or comment.is_deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

        await self._require_access(user_id, str(comment.stream_id))

        existing_result = await self.db.execute(
            select(StreamCommentReaction).where(
                StreamCommentReaction.comment_id == comment_id,
                StreamCommentReaction.user_id == user_id,
            )
        )
        existing = existing_result.scalar_one_or_none()

        if existing and existing.reaction == reaction:
            # Same reaction again - remove it (toggle off).
            await self.db.delete(existing)
            new_reaction = None
        elif existing:
            # Different reaction - replace it.
            existing.reaction = reaction
            new_reaction = reaction
        else:
            self.db.add(StreamCommentReaction(comment_id=comment_id, user_id=user_id, reaction=reaction))
            new_reaction = reaction

        await self.db.commit()
        return {
            "comment_id": str(comment_id),
            "stream_id": str(comment.stream_id),
            "user_id": str(user_id),
            "reaction": new_reaction,
        }

    async def delete_comment(self, comment_id: str, user_id: str) -> dict:
        comment_result = await self.db.execute(select(StreamComment).where(StreamComment.id == comment_id))
        comment = comment_result.scalar_one_or_none()
        if not comment or comment.is_deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

        stream = await self._get_stream(str(comment.stream_id))
        is_owner = str(comment.user_id) == str(user_id)
        is_host = str(stream.host_id) == str(user_id)
        if not is_owner and not is_host:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own comments",
            )

        comment.is_deleted = True
        comment.content = ""
        await self.db.commit()

        return {"comment_id": str(comment_id), "stream_id": str(comment.stream_id)}
