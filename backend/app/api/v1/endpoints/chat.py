# backend/app/api/v1/endpoints/chat.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services.chat_service import ChatService
from app.schemas.chat import (
    ConversationCreate, ConversationResponse,
    MessageCreate, MessageResponse,
    ChatListResponse, ConversationLogoUpdate, GroupMemberResponse
)
from typing import List, Optional
from datetime import datetime

router = APIRouter()

# ============================================
# CONVERSATION ENDPOINTS
# ============================================

@router.get("/conversations", response_model=ChatListResponse)
async def get_conversations(
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all conversations for the current user"""
    service = ChatService(db)
    conversations = await service.get_user_conversations(str(current_user.id), limit)
    return {"conversations": conversations, "total": len(conversations)}

@router.post("/conversations/direct/{user_id}")
async def get_or_create_direct_conversation(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get or create a direct conversation with another user"""
    service = ChatService(db)
    conversation = await service.get_or_create_direct_conversation(
        str(current_user.id), user_id
    )
    return conversation

@router.post("/conversations/group", response_model=ConversationResponse)
async def create_group_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a group conversation"""
    service = ChatService(db)
    return await service.create_group_conversation(str(current_user.id), data)

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """'Delete Chat' for the current user only - removes it from their own
    chat list (ChatService.get_user_conversations). The conversation, its
    other members, and all messages are completely unaffected; this never
    deletes a group or removes anyone else's access. Automatically restored
    the next time a new message arrives, or the user re-opens it (e.g. via
    GET /sections/{id}/conversation for a section chat)."""
    service = ChatService(db)
    return await service.delete_conversation_for_user(conversation_id, str(current_user.id))

# ============================================
# GROUP CHAT MEMBERS + LOGO
# ============================================

@router.get("/conversations/{conversation_id}/members", response_model=List[GroupMemberResponse])
async def get_group_members(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Enriched member list (avatar, full name, Professor/Mayor/Officer/
    Student role) for a group conversation's Members panel."""
    service = ChatService(db)
    return await service.get_group_members(conversation_id, str(current_user.id))

@router.get("/conversations/{conversation_id}/logo-permission")
async def get_group_logo_permission(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Whether the current user may change this group's logo (professor,
    mayor, or officer) - lets the frontend show/hide the option without
    guessing the permission rule itself."""
    service = ChatService(db)
    await service._require_group_conversation(conversation_id, str(current_user.id))
    can_edit = await service.can_edit_group_logo(conversation_id, str(current_user.id))
    return {"can_edit_logo": can_edit}

@router.put("/conversations/{conversation_id}/logo", response_model=ConversationResponse)
async def update_group_logo(
    conversation_id: str,
    data: ConversationLogoUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Sets a group conversation's logo - the URL is expected to already be
    uploaded via the existing /media/upload endpoint. Professor(s), mayor,
    and officer only; everyone else gets a 403."""
    service = ChatService(db)
    return await service.update_group_logo(conversation_id, str(current_user.id), data.avatar_url)

# ============================================
# MESSAGE ENDPOINTS
# ============================================

@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=100),
    before: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get messages from a conversation"""
    service = ChatService(db)
    messages = await service.get_conversation_messages(
        conversation_id, str(current_user.id), limit, before
    )
    return messages

@router.post("/messages", response_model=MessageResponse)
async def send_message(
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a message to a conversation"""
    service = ChatService(db)
    message = await service.send_message(str(current_user.id), data)

    # Get sender info for response
    return {
        "id": str(message.id),
        "conversation_id": str(message.conversation_id),
        "sender_id": str(message.sender_id),
        "sender_username": current_user.username,
        "sender_avatar": await service._get_avatar_url(str(current_user.id), current_user.role),
        "content": message.content,
        "type": message.type,
        "media_url": message.media_url,
        "media_name": message.media_name,
        "reactions": [],
        "is_read": message.is_read,
        "is_deleted": message.is_deleted,
        "created_at": message.created_at,
        "updated_at": message.updated_at
    }

@router.post("/messages/{message_id}/remove-for-me")
async def remove_message_for_me(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """'Remove for Me' - hides this message from the caller's own view only.
    Every other participant's view, and the message itself, are unaffected."""
    service = ChatService(db)
    return await service.remove_message_for_user(message_id, str(current_user.id))

@router.post("/messages/{message_id}/read")
async def mark_message_read(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a message as read"""
    service = ChatService(db)
    return await service.mark_message_as_read(message_id, str(current_user.id))