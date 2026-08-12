# backend/app/services/friend_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, func, update
from app.models.friend import Friend, FriendRequest, BlockedUser, UserReport
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

    def _get_online_ids(self) -> set:
        from app.websocket.manager import manager
        return manager.get_online_user_ids()

    async def _get_friend_id_set(self, user_id: str) -> set:
        result = await self.db.execute(select(Friend.friend_id).where(Friend.user_id == user_id))
        return {str(fid) for fid in result.scalars().all()}

    async def _compute_mutuals(self, my_friend_ids: set, other_user_id: str, preview_limit: int = 3):
        """Mutual-friend count + a small avatar preview between the current
        user (my_friend_ids) and another user, used on friend/suggestion cards."""
        other_friend_ids = await self._get_friend_id_set(other_user_id)
        mutual_ids = my_friend_ids & other_friend_ids
        avatars = []
        for uid in list(mutual_ids)[:preview_limit]:
            u_result = await self.db.execute(select(User).where(User.id == uid))
            u = u_result.scalar_one_or_none()
            if u:
                avatars.append(await self._get_avatar_url(str(u.id), u.role))
        return len(mutual_ids), avatars

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

        online_ids = self._get_online_ids()

        friend_request.sender_username = sender.username if sender else "Unknown"
        friend_request.sender_avatar = await self._get_avatar_url(str(friend_request.sender_id), sender.role) if sender else None
        friend_request.sender_online = str(friend_request.sender_id) in online_ids
        friend_request.receiver_username = receiver.username if receiver else "Unknown"
        friend_request.receiver_avatar = await self._get_avatar_url(str(friend_request.receiver_id), receiver.role) if receiver else None
        friend_request.receiver_online = str(friend_request.receiver_id) in online_ids
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

        # Check if either user has blocked the other
        blocked_result = await self.db.execute(
            select(BlockedUser).where(
                or_(
                    and_(BlockedUser.blocker_id == sender_id, BlockedUser.blocked_id == data.receiver_id),
                    and_(BlockedUser.blocker_id == data.receiver_id, BlockedUser.blocked_id == sender_id),
                )
            )
        )
        if blocked_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to send a friend request to this user"
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

        online_ids = self._get_online_ids()
        my_friend_ids = await self._get_friend_id_set(user_id)

        # Get user details for each friend
        friend_list = []
        for friend in friends:
            user_result = await self.db.execute(
                select(User).where(User.id == friend.friend_id)
            )
            user = user_result.scalar_one_or_none()
            if user:
                mutual_count, mutual_avatars = await self._compute_mutuals(my_friend_ids, str(user.id))
                friend_list.append({
                    "id": str(friend.id),
                    "user_id": str(user.id),
                    "username": user.username,
                    "email": user.email,
                    "avatar": await self._get_avatar_url(str(user.id), user.role),
                    "role": user.role,
                    "is_online": str(user.id) in online_ids,
                    "last_seen": user.last_seen,
                    "mutual_friends_count": mutual_count,
                    "mutual_friend_avatars": mutual_avatars,
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
    # SUGGESTIONS
    # ============================================

    async def get_suggestions(self, user_id: str, limit: int = 20):
        """Suggest users who aren't already friends, pending, blocked, or self -
        ranked by mutual friend count (real, computed from the friends graph)."""
        my_friend_ids = await self._get_friend_id_set(user_id)

        excluded_ids = set(my_friend_ids)
        excluded_ids.add(user_id)

        pending_result = await self.db.execute(
            select(FriendRequest.sender_id, FriendRequest.receiver_id).where(
                FriendRequest.status == 'pending',
                or_(FriendRequest.sender_id == user_id, FriendRequest.receiver_id == user_id)
            )
        )
        for sender_id, receiver_id in pending_result.all():
            excluded_ids.add(str(sender_id))
            excluded_ids.add(str(receiver_id))

        blocked_result = await self.db.execute(
            select(BlockedUser.blocker_id, BlockedUser.blocked_id).where(
                or_(BlockedUser.blocker_id == user_id, BlockedUser.blocked_id == user_id)
            )
        )
        for blocker_id, blocked_id in blocked_result.all():
            excluded_ids.add(str(blocker_id))
            excluded_ids.add(str(blocked_id))

        candidates_result = await self.db.execute(
            select(User).where(User.id.notin_(excluded_ids), User.is_active == True).limit(200)
        )
        candidates = candidates_result.scalars().all()

        suggestions = []
        for u in candidates:
            mutual_count, mutual_avatars = await self._compute_mutuals(my_friend_ids, str(u.id))
            suggestions.append({
                "user_id": str(u.id),
                "username": u.username,
                "email": u.email,
                "avatar": await self._get_avatar_url(str(u.id), u.role),
                "role": u.role,
                "mutual_friends_count": mutual_count,
                "mutual_friend_avatars": mutual_avatars,
            })

        suggestions.sort(key=lambda s: s["mutual_friends_count"], reverse=True)
        return suggestions[:limit]

    # ============================================
    # BLOCKING
    # ============================================

    async def block_user(self, user_id: str, target_id: str):
        """Block a user - removes any existing friendship and cancels any
        pending requests between the two, then prevents future requests."""
        if user_id == target_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot block yourself")

        target_result = await self.db.execute(select(User).where(User.id == target_id))
        if not target_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        existing_result = await self.db.execute(
            select(BlockedUser).where(BlockedUser.blocker_id == user_id, BlockedUser.blocked_id == target_id)
        )
        if existing_result.scalar_one_or_none():
            return {"message": "User already blocked"}

        self.db.add(BlockedUser(blocker_id=user_id, blocked_id=target_id))

        friend_result = await self.db.execute(
            select(Friend).where(
                or_(
                    and_(Friend.user_id == user_id, Friend.friend_id == target_id),
                    and_(Friend.user_id == target_id, Friend.friend_id == user_id),
                )
            )
        )
        for f in friend_result.scalars().all():
            await self.db.delete(f)

        request_result = await self.db.execute(
            select(FriendRequest).where(
                FriendRequest.status == 'pending',
                or_(
                    and_(FriendRequest.sender_id == user_id, FriendRequest.receiver_id == target_id),
                    and_(FriendRequest.sender_id == target_id, FriendRequest.receiver_id == user_id),
                )
            )
        )
        for r in request_result.scalars().all():
            r.status = 'cancelled'
            r.updated_at = datetime.utcnow()

        await self.db.commit()
        return {"message": "User blocked"}

    async def unblock_user(self, user_id: str, target_id: str):
        result = await self.db.execute(
            select(BlockedUser).where(BlockedUser.blocker_id == user_id, BlockedUser.blocked_id == target_id)
        )
        blocked = result.scalar_one_or_none()
        if not blocked:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This user is not blocked")

        await self.db.delete(blocked)
        await self.db.commit()
        return {"message": "User unblocked"}

    async def get_blocked_users(self, user_id: str):
        result = await self.db.execute(
            select(BlockedUser).where(BlockedUser.blocker_id == user_id).order_by(desc(BlockedUser.created_at))
        )
        rows = result.scalars().all()

        blocked_list = []
        for row in rows:
            u_result = await self.db.execute(select(User).where(User.id == row.blocked_id))
            u = u_result.scalar_one_or_none()
            if u:
                blocked_list.append({
                    "id": str(row.id),
                    "user_id": str(u.id),
                    "username": u.username,
                    "email": u.email,
                    "avatar": await self._get_avatar_url(str(u.id), u.role),
                    "blocked_at": row.created_at,
                })

        return {"blocked": blocked_list, "total": len(blocked_list)}

    # ============================================
    # REPORTING
    # ============================================

    async def report_user(self, reporter_id: str, target_id: str, reason: str, details: Optional[str] = None):
        if reporter_id == target_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot report yourself")

        target_result = await self.db.execute(select(User).where(User.id == target_id))
        if not target_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        self.db.add(UserReport(reporter_id=reporter_id, reported_id=target_id, reason=reason, details=details))
        await self.db.commit()
        return {"message": "Report submitted. Our team will review it."}

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