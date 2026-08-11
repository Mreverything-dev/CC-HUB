# backend/app/api/v1/endpoints/posts.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import Optional
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.models.post import Post
from app.models.like import Like
from app.models.share import Share
from app.services.post_service import PostService
from app.schemas.post import PostCreate, PostUpdate, PostResponse, FeedResponse

router = APIRouter()

# ============================================
# CREATE POST
# ============================================

@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    data: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new post"""
    service = PostService(db)
    post = await service.create_post(str(current_user.id), data)

    return {
        "id": str(post.id),
        "user_id": str(post.user_id),
        "username": current_user.username,
        "user_role": current_user.role,
        "avatar_url": await service._get_avatar_url(str(current_user.id), current_user.role),
        "content": post.content,
        "type": post.type,
        "visibility": post.visibility,
        "media_urls": post.media_urls or [],
        "likes_count": post.likes_count or 0,
        "comments_count": post.comments_count or 0,
        "shares_count": post.shares_count or 0,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "is_liked_by_current_user": False,
        "is_shared_by_current_user": False,
        "is_owned_by_current_user": True
    }

# ============================================
# GET FEED
# ============================================

@router.get("/feed", response_model=FeedResponse)
async def get_feed(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's feed with pagination"""
    service = PostService(db)
    return await service.get_feed(str(current_user.id), page, limit)

# ============================================
# GET A USER'S POSTS (for viewing their profile)
# ============================================

@router.get("/user/{user_id}", response_model=FeedResponse)
async def get_user_posts(
    user_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get another user's posts, filtered to what the current user can see"""
    service = PostService(db)
    return await service.get_user_posts(user_id, str(current_user.id), page, limit)

# ============================================
# GET SINGLE POST (✅ FIXED for polymorphic likes)
# ============================================

@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a single post by ID"""
    # Eager load user relationship
    result = await db.execute(
        select(Post)
        .options(selectinload(Post.user))
        .where(Post.id == post_id)
    )
    post = result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    # ✅ Check if current user liked the post (polymorphic like)
    is_liked_result = await db.execute(
        select(Like).where(
            and_(
                Like.target_id == post_id,
                Like.target_type == 'post',
                Like.user_id == current_user.id
            )
        )
    )
    is_liked = is_liked_result.scalar_one_or_none() is not None

    # ✅ Check if current user already shared this post
    is_shared_result = await db.execute(
        select(Share).where(
            Share.post_id == post_id,
            Share.user_id == current_user.id
        )
    )
    is_shared = is_shared_result.scalar_one_or_none() is not None

    service = PostService(db)
    role = post.user.role if post.user else "student"

    return {
        "id": str(post.id),
        "user_id": str(post.user_id),
        "username": post.user.username if post.user else "Unknown",
        "user_role": role,
        "avatar_url": await service._get_avatar_url(str(post.user_id), role),
        "content": post.content,
        "type": post.type,
        "visibility": post.visibility,
        "media_urls": post.media_urls or [],
        "likes_count": post.likes_count or 0,
        "comments_count": post.comments_count or 0,
        "shares_count": post.shares_count or 0,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "is_liked_by_current_user": is_liked,
        "is_shared_by_current_user": is_shared,
        "is_owned_by_current_user": str(post.user_id) == str(current_user.id)
    }

# ============================================
# UPDATE POST
# ============================================

@router.put("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: str,
    data: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a post"""
    service = PostService(db)
    post = await service.update_post(post_id, str(current_user.id), data)
    
    # Get user for response
    user_result = await db.execute(
        select(User).where(User.id == post.user_id)
    )
    user = user_result.scalar_one_or_none()
    role = user.role if user else "student"

    is_shared_result = await db.execute(
        select(Share).where(
            Share.post_id == post_id,
            Share.user_id == current_user.id
        )
    )
    is_shared = is_shared_result.scalar_one_or_none() is not None

    return {
        "id": str(post.id),
        "user_id": str(post.user_id),
        "username": user.username if user else "Unknown",
        "user_role": role,
        "avatar_url": await service._get_avatar_url(str(post.user_id), role),
        "content": post.content,
        "type": post.type,
        "visibility": post.visibility,
        "media_urls": post.media_urls or [],
        "likes_count": post.likes_count or 0,
        "comments_count": post.comments_count or 0,
        "shares_count": post.shares_count or 0,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "is_liked_by_current_user": False,
        "is_shared_by_current_user": is_shared,
        "is_owned_by_current_user": True
    }

# ============================================
# DELETE POST
# ============================================

@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a post"""
    service = PostService(db)
    await service.delete_post(post_id, str(current_user.id))
    return None

# ============================================
# SHARE POST
# ============================================

@router.post("/{post_id}/share")
async def share_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Record a share of a post (one share per user)"""
    service = PostService(db)
    return await service.share_post(post_id, str(current_user.id))

# ============================================
# LIKE / UNLIKE POST (✅ FIXED for polymorphic likes)
# ============================================

@router.post("/{post_id}/like")
async def toggle_like(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Like or unlike a post"""
    service = PostService(db)
    return await service.toggle_like(post_id, str(current_user.id))