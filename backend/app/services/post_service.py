# backend/app/services/post_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from datetime import datetime
import logging

from app.models.post import Post, PostMedia, PostReaction
from app.models.like import Like
from app.models.share import Share
from app.models.user import User
from app.models.friend import Friend
from app.models.section import SectionMember
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.schemas.post import PostCreate, PostUpdate

logger = logging.getLogger(__name__)

# Kept as a local module constant rather than importing from
# chat_service/announcement_service - this codebase already has one such
# constant per feature (chat_service.py, announcement_service.py,
# stream_comment_service.py all define their own), so this follows the same
# convention instead of introducing a shared cross-feature import.
ALLOWED_REACTIONS = {"❤️", "😂", "🔥", "😮", "😢", "😡", "🚀", "👏", "👍"}

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

        # Get total count (of original posts only - shares merged in below
        # are additional feed items, not counted in pagination totals, since
        # they wrap a post that's often already counted here).
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.execute(count_query)
        total = total.scalar() or 0

        # Fetch a page-sized window of BOTH original posts and shares by
        # people the viewer follows, then merge-sort and re-slice below -
        # shares never create a new Post row (see share_post), so they can
        # only be surfaced by merging the lightweight `Share` table in here,
        # not by widening the Post query itself.
        query = query.offset(0).limit(offset + limit)
        query = query.options(selectinload(Post.user))
        result = await self.db.execute(query)
        posts = result.scalars().all()

        # Shares from ANY user, newest first - visibility is decided purely
        # by whether the viewer can see the ORIGINAL post (via
        # _can_view_post below), exactly the same rule that already governs
        # seeing that post directly. Deliberately NOT restricted to shares
        # by the viewer's own friends: a share of a PUBLIC post must be
        # visible to everyone, not just the sharer's friends - the sharer's
        # own relationship to the viewer plays no part in this at all.
        share_result = await self.db.execute(
            select(Share)
            .order_by(desc(Share.created_at))
            .limit(offset + limit)
            .options(selectinload(Share.user))
        )
        shares = share_result.scalars().all()
        shared_post_originals = {}
        if shares:
            orig_result = await self.db.execute(
                select(Post)
                .where(Post.id.in_([s.post_id for s in shares]))
                .options(selectinload(Post.user))
            )
            shared_post_originals = {str(p.id): p for p in orig_result.scalars().all()}

        # Get user's liked/shared posts + a batched reaction lookup covering
        # every post about to be rendered (both plain posts and shared ones).
        liked_post_ids = await self._get_liked_post_ids(user_id)
        shared_post_ids = await self._get_shared_post_ids(user_id)
        all_post_ids = {str(p.id) for p in posts} | set(shared_post_originals.keys())
        reactions_by_post = await self._get_reactions_by_post(list(all_post_ids))

        async def build_post_dict(post: Post) -> dict:
            role = post.user.role if post.user else "student"
            return {
                "id": str(post.id),
                "user_id": str(post.user_id),
                "username": post.user.username if post.user else "Unknown",
                "user_role": role,
                "avatar_url": await self._get_avatar_url(str(post.user_id), role),
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
                "is_shared_by_current_user": str(post.id) in shared_post_ids,
                "is_owned_by_current_user": str(post.user_id) == user_id,
                **self._reaction_fields(reactions_by_post.get(str(post.id), []), user_id),
                "sort_key": post.created_at,
            }

        items = [await build_post_dict(post) for post in posts]

        for share in shares:
            original = shared_post_originals.get(str(share.post_id))
            # The original may no longer be visible/exist (deleted, or the
            # sharer's own visibility changed since) - skip it silently
            # rather than surfacing a broken/empty share card.
            if not original or not await self._can_view_post(original, user_id):
                continue
            share_dict = await build_post_dict(original)
            share_role = share.user.role if share.user else "student"
            share_dict.update({
                "is_shared": True,
                "shared_by_user_id": str(share.user_id),
                "shared_by_username": share.user.username if share.user else "Unknown",
                "shared_by_avatar_url": await self._get_avatar_url(str(share.user_id), share_role),
                "shared_by_role": share_role,
                "shared_at": share.created_at,
                "sort_key": share.created_at,
            })
            items.append(share_dict)

        items.sort(key=lambda d: d["sort_key"], reverse=True)
        page_items = items[offset:offset + limit]
        for d in page_items:
            d.pop("sort_key", None)

        return {
            "total": total,
            "page": page,
            "limit": limit,
            "items": page_items
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
        
        # Get user's liked/shared posts
        liked_post_ids = await self._get_liked_post_ids(user_id)
        shared_post_ids = await self._get_shared_post_ids(user_id)
        role = post.user.role if post.user else "student"

        return {
            "id": str(post.id),
            "user_id": str(post.user_id),
            "username": post.user.username if post.user else "Unknown",
            "user_role": role,
            "avatar_url": await self._get_avatar_url(str(post.user_id), role),
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
            "is_shared_by_current_user": str(post.id) in shared_post_ids,
            "is_owned_by_current_user": str(post.user_id) == user_id
        }

    # ============================================
    # GET POSTS BY USER (for viewing another user's profile)
    # ============================================

    async def get_user_posts(
        self,
        target_user_id: str,
        viewer_id: str,
        page: int = 1,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Get a specific user's posts, filtered to what the viewer is allowed to see"""
        offset = (page - 1) * limit

        query = (
            select(Post)
            .where(Post.user_id == target_user_id)
            .order_by(desc(Post.created_at))
            .options(selectinload(Post.user))
        )
        result = await self.db.execute(query)
        all_posts = result.scalars().all()

        visible_posts = [
            post for post in all_posts
            if await self._can_view_post(post, viewer_id)
        ]

        total = len(visible_posts)
        page_posts = visible_posts[offset:offset + limit]

        liked_post_ids = await self._get_liked_post_ids(viewer_id)
        shared_post_ids = await self._get_shared_post_ids(viewer_id)
        reactions_by_post = await self._get_reactions_by_post([str(p.id) for p in page_posts])

        items = []
        for post in page_posts:
            role = post.user.role if post.user else "student"
            items.append({
                "id": str(post.id),
                "user_id": str(post.user_id),
                "username": post.user.username if post.user else "Unknown",
                "user_role": role,
                "avatar_url": await self._get_avatar_url(str(post.user_id), role),
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
                "is_shared_by_current_user": str(post.id) in shared_post_ids,
                "is_owned_by_current_user": str(post.user_id) == viewer_id,
                **self._reaction_fields(reactions_by_post.get(str(post.id), []), viewer_id),
            })

        return {
            "total": total,
            "page": page,
            "limit": limit,
            "items": items
        }

    # ============================================
    # GET A USER'S SHARED POSTS (Profile "Shares" tab)
    # ============================================

    async def get_user_shares(
        self,
        target_user_id: str,
        viewer_id: str,
        page: int = 1,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Posts a given user has shared, newest first - each item is the
        ORIGINAL post (author, content, reactions, comments all untouched)
        plus the share_by_* wrapper fields, same shape as a shared feed item.
        Clicking one opens the original post's detail view on the frontend."""
        offset = (page - 1) * limit

        share_result = await self.db.execute(
            select(Share)
            .where(Share.user_id == target_user_id)
            .order_by(desc(Share.created_at))
            .options(selectinload(Share.user))
        )
        all_shares = share_result.scalars().all()

        if not all_shares:
            return {"total": 0, "page": page, "limit": limit, "items": []}

        orig_result = await self.db.execute(
            select(Post)
            .where(Post.id.in_([s.post_id for s in all_shares]))
            .options(selectinload(Post.user))
        )
        originals = {str(p.id): p for p in orig_result.scalars().all()}

        visible_shares = [s for s in all_shares if await self._can_view_post(originals.get(str(s.post_id)), viewer_id)] \
            if originals else []
        # Guard against a share whose original post was deleted (no longer in `originals`).
        visible_shares = [s for s in visible_shares if str(s.post_id) in originals]

        total = len(visible_shares)
        page_shares = visible_shares[offset:offset + limit]

        liked_post_ids = await self._get_liked_post_ids(viewer_id)
        shared_post_ids = await self._get_shared_post_ids(viewer_id)
        reactions_by_post = await self._get_reactions_by_post(list({str(s.post_id) for s in page_shares}))

        items = []
        for share in page_shares:
            post = originals[str(share.post_id)]
            role = post.user.role if post.user else "student"
            share_role = share.user.role if share.user else "student"
            items.append({
                "id": str(post.id),
                "user_id": str(post.user_id),
                "username": post.user.username if post.user else "Unknown",
                "user_role": role,
                "avatar_url": await self._get_avatar_url(str(post.user_id), role),
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
                "is_shared_by_current_user": str(post.id) in shared_post_ids,
                "is_owned_by_current_user": str(post.user_id) == viewer_id,
                **self._reaction_fields(reactions_by_post.get(str(post.id), []), viewer_id),
                "is_shared": True,
                "shared_by_user_id": str(share.user_id),
                "shared_by_username": share.user.username if share.user else "Unknown",
                "shared_by_avatar_url": await self._get_avatar_url(str(share.user_id), share_role),
                "shared_by_role": share_role,
                "shared_at": share.created_at,
            })

        return {
            "total": total,
            "page": page,
            "limit": limit,
            "items": items,
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

    async def bulk_delete_posts(self, post_ids: List[str], admin_id: str) -> dict:
        """Admin-only bulk removal - deletes ONLY the given post IDs, each
        one going through the exact same delete_post() above (same
        ownership/role check, same DB-level cleanup a single delete already
        gets - e.g. UserReport.post_id is ON DELETE SET NULL, so a reported
        post's report/moderation history survives deletion here exactly as
        it does for a single delete). Tolerates an id that's already gone
        (e.g. deleted moments ago by its author) rather than failing the
        whole batch over one missing post; any other error still aborts."""
        deleted_ids: List[str] = []
        not_found_ids: List[str] = []
        for post_id in post_ids:
            try:
                await self.delete_post(post_id, admin_id)
                deleted_ids.append(post_id)
            except HTTPException as e:
                if e.status_code == status.HTTP_404_NOT_FOUND:
                    not_found_ids.append(post_id)
                else:
                    raise

        logger.info(f"✅ Bulk deleted {len(deleted_ids)} post(s) by admin {admin_id}")
        return {"deleted_count": len(deleted_ids), "deleted_ids": deleted_ids, "not_found_ids": not_found_ids}

    # ============================================
    # SHARE POST
    # ============================================

    async def share_post(self, post_id: str, user_id: str) -> dict:
        """Record a share of a post - one share per user. Never creates a new
        Post row - the share is just a (user_id, post_id) pointer, surfaced
        as a feed/profile item by get_feed/get_user_shares joining back to
        this same original post."""
        result = await self.db.execute(
            select(Post).where(Post.id == post_id)
        )
        post = result.scalar_one_or_none()
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )

        existing_result = await self.db.execute(
            select(Share).where(
                Share.user_id == user_id,
                Share.post_id == post_id
            )
        )
        if existing_result.scalar_one_or_none():
            # Already shared by this user - no-op, just report current state
            return {"shares_count": post.shares_count or 0, "already_shared": True}

        self.db.add(Share(user_id=user_id, post_id=post_id))
        post.shares_count = (post.shares_count or 0) + 1
        await self.db.commit()

        logger.info(f"✅ Post {post_id} shared by user {user_id}")

        try:
            from app.websocket.manager import manager
            await manager.send_to_room(
                f"post_{post_id}",
                "post:share_updated",
                {"post_id": str(post_id), "shares_count": post.shares_count, "shared_by_user_id": str(user_id)},
            )
        except Exception as e:
            logger.error(f"❌ Failed to broadcast post share: {e}")

        return {"shares_count": post.shares_count, "already_shared": False}

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

    async def _get_liked_post_ids(self, user_id: str) -> List[str]:
        """Get list of post IDs liked by a user"""
        result = await self.db.execute(
            select(Like.target_id).where(
                Like.user_id == user_id,
                Like.target_type == "post"
            )
        )
        return [str(id) for id in result.scalars().all()]

    async def _get_shared_post_ids(self, user_id: str) -> List[str]:
        """Get list of post IDs already shared by a user"""
        result = await self.db.execute(
            select(Share.post_id).where(Share.user_id == user_id)
        )
        return [str(id) for id in result.scalars().all()]

    # ============================================
    # REACTIONS (multi-emoji, separate from the older binary Like table)
    # ============================================

    async def _get_reactions_by_post(self, post_ids: List[str]) -> Dict[str, List[PostReaction]]:
        """Batch-fetch every reaction for a set of posts in one query, grouped
        by post_id - avoids an N+1 query per post when building a feed page."""
        if not post_ids:
            return {}
        result = await self.db.execute(
            select(PostReaction).where(PostReaction.post_id.in_(post_ids))
        )
        by_post: Dict[str, List[PostReaction]] = {}
        for r in result.scalars().all():
            by_post.setdefault(str(r.post_id), []).append(r)
        return by_post

    def _reaction_fields(self, reactions: List[PostReaction], user_id: str) -> Dict[str, Any]:
        """Shapes a list of PostReaction rows into the three response fields
        every post dict exposes: total count, per-emoji breakdown, and the
        current viewer's own reaction (if any)."""
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

    async def react_to_post(self, post_id: str, user_id: str, reaction: str) -> dict:
        """Add/change/remove the caller's reaction. Same reaction twice
        removes it; a different reaction replaces it - mirrors
        AnnouncementService.react_to_announcement for consistency."""
        if reaction not in ALLOWED_REACTIONS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported reaction")

        post_result = await self.db.execute(select(Post).where(Post.id == post_id))
        post = post_result.scalar_one_or_none()
        if not post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
        if not await self._can_view_post(post, user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to react to this post",
            )

        existing_result = await self.db.execute(
            select(PostReaction).where(
                PostReaction.post_id == post_id,
                PostReaction.user_id == user_id,
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
            self.db.add(PostReaction(post_id=post_id, user_id=user_id, reaction=reaction))
            new_reaction = reaction

        await self.db.commit()

        all_result = await self.db.execute(select(PostReaction).where(PostReaction.post_id == post_id))
        all_reactions = all_result.scalars().all()
        breakdown: Dict[str, int] = {}
        for r in all_reactions:
            breakdown[r.reaction] = breakdown.get(r.reaction, 0) + 1

        payload = {
            "post_id": str(post_id),
            "user_id": str(user_id),
            "reaction": new_reaction,
            "reactions_count": len(all_reactions),
            "reaction_breakdown": breakdown,
        }

        # Best-effort real-time push to anyone currently viewing this post
        # (PostDetailModal or a PostCard on someone's feed - see usePostRoom
        # on the frontend, which joins `post_{id}` while mounted). Never lets
        # a broadcast failure fail the actual reaction write above.
        try:
            from app.websocket.manager import manager
            await manager.send_to_room(f"post_{post_id}", "post:reaction_updated", payload)
        except Exception as e:
            logger.error(f"❌ Failed to broadcast post reaction: {e}")

        return payload

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