# backend/app/api/v1/endpoints/comments.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services.comment_service import CommentService
from app.schemas.comment import CommentCreate, CommentUpdate, CommentResponse, CommentListResponse

router = APIRouter()

# ============================================
# LIST / CREATE COMMENTS FOR A POST
# ============================================

@router.get("/post/{post_id}", response_model=CommentListResponse)
async def get_comments(
    post_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get comments for a post"""
    service = CommentService(db)
    return await service.get_comments(post_id, str(current_user.id), page, limit)

@router.post("/post/{post_id}", response_model=CommentResponse, status_code=201)
async def create_comment(
    post_id: str,
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a comment to a post"""
    service = CommentService(db)
    comment = await service.create_comment(post_id, str(current_user.id), data)
    return {
        "id": str(comment.id),
        "post_id": str(comment.post_id),
        "user_id": str(comment.user_id),
        "username": current_user.username,
        "user_role": current_user.role,
        "avatar_url": await service._get_avatar_url(str(current_user.id), current_user.role),
        "parent_id": str(comment.parent_id) if comment.parent_id else None,
        "content": comment.content,
        "likes_count": 0,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
        "is_liked_by_current_user": False,
        "is_owned_by_current_user": True,
    }

# ============================================
# UPDATE / DELETE A COMMENT
# ============================================

@router.put("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: str,
    data: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Edit a comment (owner only)"""
    service = CommentService(db)
    comment = await service.update_comment(comment_id, str(current_user.id), data)
    return {
        "id": str(comment.id),
        "post_id": str(comment.post_id),
        "user_id": str(comment.user_id),
        "username": current_user.username,
        "user_role": current_user.role,
        "avatar_url": await service._get_avatar_url(str(comment.user_id), current_user.role),
        "parent_id": str(comment.parent_id) if comment.parent_id else None,
        "content": comment.content,
        "likes_count": comment.likes_count or 0,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
        "is_liked_by_current_user": False,
        "is_owned_by_current_user": True,
    }

@router.delete("/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a comment (owner or admin)"""
    service = CommentService(db)
    await service.delete_comment(comment_id, str(current_user.id))
    return None

# ============================================
# LIKE / UNLIKE A COMMENT
# ============================================

@router.post("/{comment_id}/like")
async def toggle_comment_like(
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Like or unlike a comment"""
    service = CommentService(db)
    return await service.toggle_like(comment_id, str(current_user.id))
