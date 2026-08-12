# backend/app/api/v1/endpoints/friends.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services.friend_service import FriendService
from app.schemas.friend import (
    FriendRequestCreate, FriendRequestUpdate,
    FriendRequestResponse, FriendResponse,
    FriendListResponse, FriendRequestListResponse,
    SuggestionResponse, BlockedUserListResponse, UserReportCreate
)
from typing import List

router = APIRouter()

# ============================================
# FRIEND REQUESTS
# ============================================

@router.post("/requests", response_model=FriendRequestResponse)
async def send_friend_request(
    data: FriendRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a friend request"""
    service = FriendService(db)
    return await service.send_friend_request(str(current_user.id), data)

@router.put("/requests/{request_id}", response_model=FriendRequestResponse)
async def respond_to_friend_request(
    request_id: str,
    data: FriendRequestUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accept or reject a friend request"""
    service = FriendService(db)
    return await service.respond_to_friend_request(request_id, str(current_user.id), data)

@router.delete("/requests/{request_id}")
async def cancel_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Cancel a friend request"""
    service = FriendService(db)
    return await service.cancel_friend_request(request_id, str(current_user.id))

@router.get("/requests", response_model=FriendRequestListResponse)
async def get_friend_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all friend requests"""
    service = FriendService(db)
    return await service.get_friend_requests(str(current_user.id))

# ============================================
# FRIENDS
# ============================================

@router.get("/", response_model=FriendListResponse)
async def get_friends(
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all friends"""
    service = FriendService(db)
    return await service.get_user_friends(str(current_user.id), limit, skip)

@router.delete("/{friend_id}")
async def remove_friend(
    friend_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a friend"""
    service = FriendService(db)
    return await service.remove_friend(str(current_user.id), friend_id)

# ============================================
# SUGGESTIONS
# ============================================

@router.get("/suggestions", response_model=List[SuggestionResponse])
async def get_suggestions(
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get friend suggestions ranked by mutual friend count"""
    service = FriendService(db)
    return await service.get_suggestions(str(current_user.id), limit)

# ============================================
# BLOCKING
# ============================================

@router.get("/blocked", response_model=BlockedUserListResponse)
async def get_blocked_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the current user's blocked users"""
    service = FriendService(db)
    return await service.get_blocked_users(str(current_user.id))

@router.post("/block/{user_id}")
async def block_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Block a user"""
    service = FriendService(db)
    return await service.block_user(str(current_user.id), user_id)

@router.delete("/block/{user_id}")
async def unblock_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unblock a user"""
    service = FriendService(db)
    return await service.unblock_user(str(current_user.id), user_id)

# ============================================
# REPORTING
# ============================================

@router.post("/report/{user_id}")
async def report_user(
    user_id: str,
    data: UserReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Report a user"""
    service = FriendService(db)
    return await service.report_user(str(current_user.id), user_id, data.reason, data.details)

# ============================================
# NOTIFICATIONS
# ============================================

@router.get("/notifications")
async def get_notifications(
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's notifications"""
    service = FriendService(db)
    return await service.get_notifications(str(current_user.id), limit, skip)

@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a notification as read"""
    service = FriendService(db)
    return await service.mark_notification_read(notification_id, str(current_user.id))

@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all notifications as read"""
    service = FriendService(db)
    return await service.mark_all_notifications_read(str(current_user.id))