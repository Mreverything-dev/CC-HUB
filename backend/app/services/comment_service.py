# backend/app/services/comment_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from datetime import datetime
import logging

from app.models.comment import Comment
from app.models.post import Post
from app.models.user import User
from app.models.like import Like
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.schemas.comment import CommentCreate, CommentUpdate

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

        post_result = await self.db.execute(
            select(Post).where(Post.id == comment.post_id)
        )
        post = post_result.scalar_one_or_none()
        if post and post.comments_count:
            post.comments_count = max(0, post.comments_count - 1)

        await self.db.delete(comment)
        await self.db.commit()

        logger.info(f"✅ Comment {comment_id} deleted by user {user_id}")
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
