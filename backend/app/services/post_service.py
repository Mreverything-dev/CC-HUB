# backend/app/services/post_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from datetime import datetime
import logging

from app.models.post import Post, PostMedia
from app.models.like import Like
from app.models.user import User
from app.models.friend import Friend
from app.models.section import SectionMember
from app.schemas.post import PostCreate, PostUpdate

logger = logging.getLogger(__name__)

class PostService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ============================================
    # CREATE POST
    # ============================================
    
    async def create_post(self, user_id: str, data: PostCreate) -> Post:
        """Create a new post"""
        # Check if user exists
        user_result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Create post
        post = Post(
            user_id=user_id,
            content=data.content,
            type=data.type,
            visibility=data.visibility,
            media_urls=data.media_urls
        )
        
        self.db.add(post)
        await self.db.commit()
        await self.db.refresh(post)
        
        logger.info(f"✅ Post created by user {user_id}")
        return post

    # ============================================
    # GET FEED
    # ============================================
    
    async def get_feed(
        self,
        user_id: str,
        page: int = 1,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Get user's feed with pagination"""
        offset = (page - 1) * limit
        
        # Get user's friends (for friends visibility)
        friend_ids = await self._get_friend_ids(user_id)
        
        # Get user's sections (for section visibility)
        section_ids = await self._get_section_ids(user_id)
        
        # Build query
        query = select(Post)
        
        # Visibility filter
        visibility_conditions = [
            Post.visibility == "public",  # Public posts are visible to everyone
        ]
        
        if friend_ids:
            # Posts from friends
            visibility_conditions.append(
                and_(
                    Post.visibility == "friends",
                    Post.user_id.in_(friend_ids)
                )
            )
        else:
            # If no friends, only show public posts from friends visibility
            visibility_conditions.append(
                and_(
                    Post.visibility == "friends",
                    Post.user_id.in_([user_id])  # User's own friends-only posts
                )
            )
        
        if section_ids:
            # Posts from sections
            visibility_conditions.append(
                and_(
                    Post.visibility == "section",
                    Post.user_id.in_(
                        select(SectionMember.user_id).where(
                            SectionMember.section_id.in_(section_ids)
                        )
                    )
                )
            )
        else:
            # If no sections, only show user's own section posts
            visibility_conditions.append(
                and_(
                    Post.visibility == "section",
                    Post.user_id == user_id
                )
            )
        
        # Add user's own posts (always visible)
        visibility_conditions.append(Post.user_id == user_id)
        
        query = query.where(or_(*visibility_conditions))
        query = query.order_by(desc(Post.created_at))
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.execute(count_query)
        total = total.scalar() or 0
        
        # Get paginated results
        query = query.offset(offset).limit(limit)
        query = query.options(selectinload(Post.user))
        result = await self.db.execute(query)
        posts = result.scalars().all()
        
        # Get user's liked posts
        liked_post_ids = await self._get_liked_post_ids(user_id)
        
        # Format response
        items = []
        for post in posts:
            post_dict = {
                "id": str(post.id),
                "user_id": str(post.user_id),
                "username": post.user.username if post.user else "Unknown",
                "content": post.content,
                "type": post.type,
                "visibility": post.visibility,
                "media_urls": post.media_urls,
                "likes_count": post.likes_count,
                "comments_count": post.comments_count,
                "shares_count": post.shares_count,
                "created_at": post.created_at,
                "updated_at": post.updated_at,
                "is_liked_by_current_user": str(post.id) in liked_post_ids,
                "is_owned_by_current_user": str(post.user_id) == user_id
            }
            items.append(post_dict)
        
        return {
            "total": total,
            "page": page,
            "limit": limit,
            "items": items
        }

    # ============================================
    # GET SINGLE POST
    # ============================================
    
    async def get_post(self, post_id: str, user_id: str) -> dict:
        """Get a single post by ID"""
        result = await self.db.execute(
            select(Post).where(Post.id == post_id)
        )
        post = result.scalar_one_or_none()
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )
        
        # Check visibility
        if not await self._can_view_post(post, user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view this post"
            )
        
        # Get user's liked posts
        liked_post_ids = await self._get_liked_post_ids(user_id)
        
        return {
            "id": str(post.id),
            "user_id": str(post.user_id),
            "username": post.user.username if post.user else "Unknown",
            "content": post.content,
            "type": post.type,
            "visibility": post.visibility,
            "media_urls": post.media_urls,
            "likes_count": post.likes_count,
            "comments_count": post.comments_count,
            "shares_count": post.shares_count,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
            "is_liked_by_current_user": str(post.id) in liked_post_ids,
            "is_owned_by_current_user": str(post.user_id) == user_id
        }

    # ============================================
    # UPDATE POST
    # ============================================
    
    async def update_post(self, post_id: str, user_id: str, data: PostUpdate) -> Post:
        """Update a post"""
        result = await self.db.execute(
            select(Post).where(Post.id == post_id)
        )
        post = result.scalar_one_or_none()
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )
        
        # Check ownership
        if str(post.user_id) != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this post"
            )
        
        # Update fields
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(post, key, value)
        
        post.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(post)
        
        logger.info(f"✅ Post {post_id} updated by user {user_id}")
        return post

    # ============================================
    # DELETE POST
    # ============================================
    
    async def delete_post(self, post_id: str, user_id: str) -> dict:
        """Delete a post"""
        result = await self.db.execute(
            select(Post).where(Post.id == post_id)
        )
        post = result.scalar_one_or_none()
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )
        
        # Check ownership or admin
        user_result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if str(post.user_id) != user_id and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this post"
            )
        
        await self.db.delete(post)
        await self.db.commit()
        
        logger.info(f"✅ Post {post_id} deleted by user {user_id}")
        return {"message": "Post deleted successfully"}

    # ============================================
    # LIKE / UNLIKE POST
    # ============================================
    
    async def toggle_like(self, post_id: str, user_id: str) -> dict:
        """Like or unlike a post"""
        # Check if post exists
        post_result = await self.db.execute(
            select(Post).where(Post.id == post_id)
        )
        post = post_result.scalar_one_or_none()
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )
        
        # Check if already liked
        like_result = await self.db.execute(
            select(Like).where(
                Like.user_id == user_id,
                Like.target_type == "post",
                Like.target_id == post_id
            )
        )
        existing_like = like_result.scalar_one_or_none()
        
        if existing_like:
            # Unlike
            await self.db.delete(existing_like)
            post.likes_count -= 1
            await self.db.commit()
            return {"liked": False, "likes_count": post.likes_count}
        else:
            # Like
            like = Like(
                user_id=user_id,
                target_type="post",
                target_id=post_id
            )
            self.db.add(like)
            post.likes_count += 1
            await self.db.commit()
            return {"liked": True, "likes_count": post.likes_count}

    # ============================================
    # HELPER METHODS
    # ============================================
    
    async def _get_friend_ids(self, user_id: str) -> List[str]:
        """Get list of friend IDs for a user"""
        result = await self.db.execute(
            select(Friend.friend_id).where(Friend.user_id == user_id)
        )
        return [str(id) for id in result.scalars().all()]

    async def _get_section_ids(self, user_id: str) -> List[str]:
        """Get list of section IDs for a user"""
        result = await self.db.execute(
            select(SectionMember.section_id).where(SectionMember.user_id == user_id)
        )
        return [str(id) for id in result.scalars().all()]

    async def _get_liked_post_ids(self, user_id: str) -> List[str]:
        """Get list of post IDs liked by a user"""
        result = await self.db.execute(
            select(Like.target_id).where(
                Like.user_id == user_id,
                Like.target_type == "post"
            )
        )
        return [str(id) for id in result.scalars().all()]

    async def _can_view_post(self, post: Post, user_id: str) -> bool:
        """Check if a user can view a post"""
        # Own post
        if str(post.user_id) == user_id:
            return True
        
        # Public post
        if post.visibility == "public":
            return True
        
        # Friends post
        if post.visibility == "friends":
            friends = await self._get_friend_ids(user_id)
            return str(post.user_id) in friends
        
        # Section post
        if post.visibility == "section":
            sections = await self._get_section_ids(user_id)
            # Check if user is in any section with the post author
            result = await self.db.execute(
                select(SectionMember.section_id).where(
                    SectionMember.user_id == post.user_id
                )
            )
            author_sections = [str(id) for id in result.scalars().all()]
            return any(section in sections for section in author_sections)
        
        # Private post
        return False