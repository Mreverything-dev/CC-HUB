# backend/app/api/v1/endpoints/posts.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
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
        "content": post.content,
        "type": post.type,
        "visibility": post.visibility,
        "media_urls": post.media_urls,
        "likes_count": post.likes_count,
        "comments_count": post.comments_count,
        "shares_count": post.shares_count,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "is_liked_by_current_user": False,
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
# GET SINGLE POST
# ============================================

@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a single post by ID"""
    service = PostService(db)
    return await service.get_post(post_id, str(current_user.id))

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
    
    return {
        "id": str(post.id),
        "user_id": str(post.user_id),
        "username": current_user.username,
        "content": post.content,
        "type": post.type,
        "visibility": post.visibility,
        "media_urls": post.media_urls,
        "likes_count": post.likes_count,
        "comments_count": post.comments_count,
        "shares_count": post.shares_count,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "is_liked_by_current_user": False,
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
# LIKE / UNLIKE POST
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