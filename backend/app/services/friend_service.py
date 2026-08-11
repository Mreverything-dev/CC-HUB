# backend/app/services/friend_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, func, update
from app.models.friend import Friend, FriendRequest
from app.models.user import User
from app.models.notification import Notification
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.schemas.friend import FriendRequestCreate, FriendRequestUpdate
from fastapi import HTTPException, status
from datetime import datetime
from typing import Optional

class FriendService:
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

    async def _attach_request_display_fields(self, friend_request: FriendRequest) -> FriendRequest:
        """Attach sender/receiver username+avatar - required by FriendRequestResponse but not real columns"""
        sender_result = await self.db.execute(
            select(User).where(User.id == friend_request.sender_id)
        )
        sender = sender_result.scalar_one_or_none()
        receiver_result = await self.db.execute(
            select(User).where(User.id == friend_request.receiver_id)
        )
        receiver = receiver_result.scalar_one_or_none()

        friend_request.sender_username = sender.username if sender else "Unknown"
        friend_request.sender_avatar = await self._get_avatar_url(str(friend_request.sender_id), sender.role) if sender else None
        friend_request.receiver_username = receiver.username if receiver else "Unknown"
        friend_request.receiver_avatar = await self._get_avatar_url(str(friend_request.receiver_id), receiver.role) if receiver else None
        return friend_request

    # ============================================
    # FRIEND REQUESTS
    # ============================================
    
    async def send_friend_request(self, sender_id: str, data: FriendRequestCreate):
        """Send a friend request to another user"""
        sender_result = await self.db.execute(
            select(User).where(User.id == sender_id)
        )
        sender = sender_result.scalar_one_or_none()

        # Check if receiver exists
        result = await self.db.execute(
            select(User).where(User.id == data.receiver_id)
        )
        receiver = result.scalar_one_or_none()
        if not receiver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if sender_id == data.receiver_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot send friend request to yourself"
            )
        
        # Check if already friends
        result = await self.db.execute(
            select(Friend).where(
                or_(
                    and_(Friend.user_id == sender_id, Friend.friend_id == data.receiver_id),
                    and_(Friend.user_id == data.receiver_id, Friend.friend_id == sender_id)
                )
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already friends with this user"
            )
        
        # Check if request already exists
        result = await self.db.execute(
            select(FriendRequest).where(
                and_(
                    FriendRequest.sender_id == sender_id,
                    FriendRequest.receiver_id == data.receiver_id,
                    FriendRequest.status == 'pending'
                )
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Friend request already sent"
            )
        
        # Create friend request
        friend_request = FriendRequest(
            sender_id=sender_id,
            receiver_id=data.receiver_id,
            message=data.message
        )
        self.db.add(friend_request)
        await self.db.commit()
        await self.db.refresh(friend_request)
        
        # ✅ Send notification to receiver
        sender_name = sender.username if sender else "Someone"
        await self.create_notification(
            user_id=data.receiver_id,
            type="friend_request",
            title="New Friend Request",
            content=f"{sender_name} sent you a friend request",
            data={
                "request_id": str(friend_request.id),
                "sender_id": sender_id
            }
        )

        return await self._attach_request_display_fields(friend_request)

    async def respond_to_friend_request(self, request_id: str, user_id: str, data: FriendRequestUpdate):
        """Accept or reject a friend request"""
        # Get the request
        result = await self.db.execute(
            select(FriendRequest).where(FriendRequest.id == request_id)
        )
        friend_request = result.scalar_one_or_none()
        if not friend_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Friend request not found"
            )
        
        # Check if user is the receiver
        if str(friend_request.receiver_id) != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to respond to this request"
            )
        
        if friend_request.status != 'pending':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Request already {friend_request.status}"
            )
        
        # Update status
        friend_request.status = data.status
        friend_request.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(friend_request)
        
        # If accepted, create friendship
        if data.status == 'accepted':
            # Add both directions
            friend1 = Friend(
                user_id=friend_request.sender_id,
                friend_id=friend_request.receiver_id
            )
            friend2 = Friend(
                user_id=friend_request.receiver_id,
                friend_id=friend_request.sender_id
            )
            self.db.add_all([friend1, friend2])
            await self.db.commit()

            # ✅ Send notification to sender
            responder_result = await self.db.execute(
                select(User).where(User.id == user_id)
            )
            responder = responder_result.scalar_one_or_none()
            responder_name = responder.username if responder else "Someone"
            await self.create_notification(
                user_id=friend_request.sender_id,
                type="friend_accepted",
                title="Friend Request Accepted",
                content=f"{responder_name} accepted your friend request",
                data={
                    "request_id": str(friend_request.id),
                    "user_id": user_id
                }
            )

        return await self._attach_request_display_fields(friend_request)

    async def cancel_friend_request(self, request_id: str, user_id: str):
        """Cancel a friend request"""
        result = await self.db.execute(
            select(FriendRequest).where(FriendRequest.id == request_id)
        )
        friend_request = result.scalar_one_or_none()
        if not friend_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Friend request not found"
            )
        
        if str(friend_request.sender_id) != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only cancel your own requests"
            )
        
        friend_request.status = 'cancelled'
        friend_request.updated_at = datetime.utcnow()
        await self.db.commit()
        
        return {"message": "Friend request cancelled"}

    # ============================================
    # FRIENDS
    # ============================================
    
    async def get_user_friends(self, user_id: str, limit: int = 50, skip: int = 0):
        """Get all friends of a user"""
        result = await self.db.execute(
            select(Friend)
            .where(Friend.user_id == user_id)
            .offset(skip)
            .limit(limit)
            .order_by(desc(Friend.created_at))
        )
        friends = result.scalars().all()
        
        # Get user details for each friend
        friend_list = []
        for friend in friends:
            user_result = await self.db.execute(
                select(User).where(User.id == friend.friend_id)
            )
            user = user_result.scalar_one_or_none()
            if user:
                friend_list.append({
                    "id": str(friend.id),
                    "user_id": str(user.id),
                    "username": user.username,
                    "email": user.email,
                    "avatar": await self._get_avatar_url(str(user.id), user.role),
                    "created_at": friend.created_at
                })
        
        # Get total count
        count_result = await self.db.execute(
            select(func.count()).where(Friend.user_id == user_id)
        )
        total = count_result.scalar()
        
        return {
            "friends": friend_list,
            "total": total
        }

    async def get_friend_requests(self, user_id: str):
        """Get all friend requests for a user"""
        # Received requests
        received_result = await self.db.execute(
            select(FriendRequest)
            .where(
                FriendRequest.receiver_id == user_id,
                FriendRequest.status == 'pending'
            )
            .order_by(desc(FriendRequest.created_at))
        )
        received = received_result.scalars().all()
        
        # Sent requests
        sent_result = await self.db.execute(
            select(FriendRequest)
            .where(
                FriendRequest.sender_id == user_id,
                FriendRequest.status == 'pending'
            )
            .order_by(desc(FriendRequest.created_at))
        )
        sent = sent_result.scalars().all()

        sent = [await self._attach_request_display_fields(r) for r in sent]
        received = [await self._attach_request_display_fields(r) for r in received]

        return {
            "sent": sent,
            "received": received,
            "total": len(sent) + len(received)
        }

    async def remove_friend(self, user_id: str, friend_id: str):
        """Remove a friend"""
        # Remove both directions
        result = await self.db.execute(
            select(Friend).where(
                or_(
                    and_(Friend.user_id == user_id, Friend.friend_id == friend_id),
                    and_(Friend.user_id == friend_id, Friend.friend_id == user_id)
                )
            )
        )
        friends = result.scalars().all()
        
        if not friends:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Friend not found"
            )
        
        for friend in friends:
            await self.db.delete(friend)
        
        await self.db.commit()
        return {"message": "Friend removed"}

    # ============================================
    # NOTIFICATIONS
    # ============================================
    
    async def create_notification(self, user_id: str, type: str, title: str, content: str, data: dict = None):
        """Create a notification"""
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            content=content,
            data=data or {}
        )
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)
        
        # ✅ Send real-time notification via WebSocket
        from app.websocket.manager import manager
        await manager.send_to_user(
            user_id=user_id,
            event='new_notification',
            data={
                "id": str(notification.id),
                "type": notification.type,
                "title": notification.title,
                "content": notification.content,
                "data": notification.data,
                "created_at": notification.created_at.isoformat()
            }
        )
        
        return notification

    async def get_notifications(self, user_id: str, limit: int = 50, skip: int = 0):
        """Get user's notifications"""
        result = await self.db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(desc(Notification.created_at))
            .offset(skip)
            .limit(limit)
        )
        notifications = result.scalars().all()
        
        # Get unread count
        count_result = await self.db.execute(
            select(func.count())
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
        )
        unread_count = count_result.scalar()
        
        return {
            "notifications": notifications,
            "unread_count": unread_count
        }

    async def mark_notification_read(self, notification_id: str, user_id: str):
        """Mark a notification as read"""
        result = await self.db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        await self.db.commit()
        
        return notification

    async def mark_all_notifications_read(self, user_id: str):
        """Mark all notifications as read"""
        await self.db.execute(
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
            .values(is_read=True, read_at=datetime.utcnow())
        )
        await self.db.commit()
        return {"message": "All notifications marked as read"}