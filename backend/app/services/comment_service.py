# backend/app/services/comment_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from datetime import datetime
import logging

from app.models.comment import Comment, CommentReaction
from app.models.post import Post
from app.models.user import User
from app.models.like import Like
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.schemas.comment import CommentCreate, CommentUpdate
from app.services.post_service import ALLOWED_REACTIONS

logger = logging.getLogger(__name__)

class CommentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ============================================
    # CREATE COMMENT
    # ============================================

    async def create_comment(self, post_id: str, user_id: str, data: CommentCreate) -> Comment:
        """Create a comment on a post"""
        post_result = await self.db.execute(
            select(Post).where(Post.id == post_id)
        )
        post = post_result.scalar_one_or_none()
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )

        if data.parent_id:
            parent_result = await self.db.execute(
                select(Comment).where(Comment.id == data.parent_id, Comment.post_id == post_id)
            )
            if not parent_result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Parent comment not found"
                )

        comment = Comment(
            post_id=post_id,
            user_id=user_id,
            parent_id=data.parent_id,
            content=data.content,
            image_url=data.image_url,
        )
        self.db.add(comment)

        post.comments_count = (post.comments_count or 0) + 1

        await self.db.commit()
        await self.db.refresh(comment)

        logger.info(f"✅ Comment created on post {post_id} by user {user_id}")

        try:
            from app.websocket.manager import manager
            author_result = await self.db.execute(select(User).where(User.id == user_id))
            author = author_result.scalar_one_or_none()
            author_role = author.role if author else "student"
            await manager.send_to_room(
                f"post_{post_id}",
                "post:comment_added",
                {
                    "post_id": str(post_id),
                    "comments_count": post.comments_count,
                    "comment": {
                        "id": str(comment.id),
                        "post_id": str(post_id),
                        "user_id": str(user_id),
                        "username": author.username if author else "Unknown",
                        "user_role": author_role,
                        "avatar_url": await self._get_avatar_url(user_id, author_role),
                        "parent_id": str(comment.parent_id) if comment.parent_id else None,
                        "content": comment.content,
                        "image_url": comment.image_url,
                        "likes_count": 0,
                        "created_at": comment.created_at.isoformat() if comment.created_at else None,
                        "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
                        "reactions_count": 0,
                        "reaction_breakdown": {},
                    },
                },
            )
        except Exception as e:
            logger.error(f"❌ Failed to broadcast new comment: {e}")

        return comment

    # ============================================
    # GET COMMENTS FOR A POST
    # ============================================

    async def get_comments(self, post_id: str, viewer_id: str, page: int = 1, limit: int = 50) -> Dict[str, Any]:
        """Get comments for a post, newest first"""
        post_result = await self.db.execute(
            select(Post).where(Post.id == post_id)
        )
        if not post_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )

        offset = (page - 1) * limit

        count_result = await self.db.execute(
            select(Comment).where(Comment.post_id == post_id)
        )
        all_comments = count_result.scalars().all()
        total = len(all_comments)

        result = await self.db.execute(
            select(Comment)
            .where(Comment.post_id == post_id)
            .order_by(desc(Comment.created_at))
            .offset(offset)
            .limit(limit)
            .options(selectinload(Comment.user))
        )
        comments = result.scalars().all()

        liked_comment_ids = await self._get_liked_comment_ids(viewer_id)
        reactions_by_comment = await self._get_reactions_by_comment([str(c.id) for c in comments])

        items = []
        for comment in comments:
            role = comment.user.role if comment.user else "student"
            items.append({
                "id": str(comment.id),
                "post_id": str(comment.post_id),
                "user_id": str(comment.user_id),
                "username": comment.user.username if comment.user else "Unknown",
                "user_role": role,
                "avatar_url": await self._get_avatar_url(str(comment.user_id), role),
                "parent_id": str(comment.parent_id) if comment.parent_id else None,
                "content": comment.content,
                "image_url": comment.image_url,
                "likes_count": comment.likes_count or 0,
                "created_at": comment.created_at,
                "updated_at": comment.updated_at,
                "is_liked_by_current_user": str(comment.id) in liked_comment_ids,
                "is_owned_by_current_user": str(comment.user_id) == viewer_id,
                **self._reaction_fields(reactions_by_comment.get(str(comment.id), []), viewer_id),
            })

        return {"total": total, "items": items}

    # ============================================
    # UPDATE COMMENT
    # ============================================

    async def update_comment(self, comment_id: str, user_id: str, data: CommentUpdate) -> Comment:
        """Edit a comment (owner only)"""
        comment = await self._get_comment(comment_id)

        if str(comment.user_id) != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to edit this comment"
            )

        comment.content = data.content
        comment.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(comment)

        logger.info(f"✅ Comment {comment_id} updated by user {user_id}")
        return comment

    # ============================================
    # DELETE COMMENT
    # ============================================

    async def delete_comment(self, comment_id: str, user_id: str) -> dict:
        """Delete a comment (owner or admin only)"""
        comment = await self._get_comment(comment_id)

        user_result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()

        if str(comment.user_id) != user_id and (not user or user.role != "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this comment"
            )

        post_id = str(comment.post_id)
        post_result = await self.db.execute(
            select(Post).where(Post.id == comment.post_id)
        )
        post = post_result.scalar_one_or_none()
        if post and post.comments_count:
            post.comments_count = max(0, post.comments_count - 1)

        await self.db.delete(comment)
        await self.db.commit()

        logger.info(f"✅ Comment {comment_id} deleted by user {user_id}")

        try:
            from app.websocket.manager import manager
            await manager.send_to_room(
                f"post_{post_id}",
                "post:comment_deleted",
                {"post_id": post_id, "comment_id": str(comment_id), "comments_count": post.comments_count if post else 0},
            )
        except Exception as e:
            logger.error(f"❌ Failed to broadcast comment deletion: {e}")

        return {"message": "Comment deleted successfully"}

    # ============================================
    # LIKE / UNLIKE COMMENT
    # ============================================

    async def toggle_like(self, comment_id: str, user_id: str) -> dict:
        """Like or unlike a comment"""
        comment = await self._get_comment(comment_id)

        like_result = await self.db.execute(
            select(Like).where(
                Like.user_id == user_id,
                Like.target_type == "comment",
                Like.target_id == comment_id
            )
        )
        existing_like = like_result.scalar_one_or_none()

        if existing_like:
            await self.db.delete(existing_like)
            comment.likes_count = max(0, (comment.likes_count or 0) - 1)
            await self.db.commit()
            return {"liked": False, "likes_count": comment.likes_count}
        else:
            like = Like(user_id=user_id, target_type="comment", target_id=comment_id)
            self.db.add(like)
            comment.likes_count = (comment.likes_count or 0) + 1
            await self.db.commit()
            return {"liked": True, "likes_count": comment.likes_count}

    # ============================================
    # HELPER METHODS
    # ============================================

    async def _get_comment(self, comment_id: str) -> Comment:
        result = await self.db.execute(
            select(Comment).where(Comment.id == comment_id)
        )
        comment = result.scalar_one_or_none()
        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Comment not found"
            )
        return comment

    async def _get_liked_comment_ids(self, user_id: str) -> List[str]:
        result = await self.db.execute(
            select(Like.target_id).where(
                Like.user_id == user_id,
                Like.target_type == "comment"
            )
        )
        return [str(id) for id in result.scalars().all()]

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

    # ============================================
    # REACTIONS (multi-emoji, mirrors PostService.react_to_post exactly)
    # ============================================

    async def _get_reactions_by_comment(self, comment_ids: List[str]) -> Dict[str, List[CommentReaction]]:
        if not comment_ids:
            return {}
        result = await self.db.execute(
            select(CommentReaction).where(CommentReaction.comment_id.in_(comment_ids))
        )
        by_comment: Dict[str, List[CommentReaction]] = {}
        for r in result.scalars().all():
            by_comment.setdefault(str(r.comment_id), []).append(r)
        return by_comment

    def _reaction_fields(self, reactions: List[CommentReaction], user_id: str) -> Dict[str, Any]:
        breakdown: Dict[str, int] = {}
        my_reaction = None
        for r in reactions:
            breakdown[r.reaction] = breakdown.get(r.reaction, 0) + 1
            if str(r.user_id) == user_id:
                my_reaction = r.reaction
        return {
            "reactions_count": len(reactions),
            "reaction_breakdown": breakdown,
            "my_reaction": my_reaction,
        }

    async def react_to_comment(self, comment_id: str, user_id: str, reaction: str) -> dict:
        """Add/change/remove the caller's reaction on a comment. Same
        reaction twice removes it; a different reaction replaces it."""
        if reaction not in ALLOWED_REACTIONS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported reaction")

        comment = await self._get_comment(comment_id)

        existing_result = await self.db.execute(
            select(CommentReaction).where(
                CommentReaction.comment_id == comment_id,
                CommentReaction.user_id == user_id,
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
            self.db.add(CommentReaction(comment_id=comment_id, user_id=user_id, reaction=reaction))
            new_reaction = reaction

        await self.db.commit()

        all_result = await self.db.execute(
            select(CommentReaction).where(CommentReaction.comment_id == comment_id)
        )
        all_reactions = all_result.scalars().all()
        breakdown: Dict[str, int] = {}
        for r in all_reactions:
            breakdown[r.reaction] = breakdown.get(r.reaction, 0) + 1

        payload = {
            "post_id": str(comment.post_id),
            "comment_id": str(comment_id),
            "user_id": str(user_id),
            "reaction": new_reaction,
            "reactions_count": len(all_reactions),
            "reaction_breakdown": breakdown,
        }

        try:
            from app.websocket.manager import manager
            await manager.send_to_room(f"post_{comment.post_id}", "post:comment_reaction_updated", payload)
        except Exception as e:
            logger.error(f"❌ Failed to broadcast comment reaction: {e}")

        return payload
