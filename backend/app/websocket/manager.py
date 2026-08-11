# backend/app/websocket/manager.py
import socketio
from typing import Dict, List, Any
import logging
from app.services.chat_service import ChatService
from app.core.database import AsyncSessionLocal
from app.core.security import decode_token
from datetime import datetime
logger = logging.getLogger(__name__)
from sqlalchemy import select, desc, and_, or_, func, update 
sio = socketio.AsyncServer(
    cors_allowed_origins='*',
    async_mode='asgi',
    logger=True
)

class SocketManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, Any]] = {}
        self.user_rooms: Dict[str, List[str]] = {}

    async def connect(self, sid: str, token: str):
        """Handle user connection"""
        try:
            payload = decode_token(token)
            if not payload:
                await sio.emit('error', {'message': 'Invalid token'}, room=sid)
                return False
            
            user_id = payload.get('sub')
            if not user_id:
                await sio.emit('error', {'message': 'Invalid token payload'}, room=sid)
                return False
            
            self.active_connections[sid] = {
                'user_id': user_id,
                'sid': sid
            }
            
            logger.info(f"✅ User {user_id} connected with SID {sid}")
            await sio.emit('connected', {'user_id': user_id}, room=sid)
            return True
            
        except Exception as e:
            logger.error(f"❌ Connection error: {e}")
            await sio.emit('error', {'message': str(e)}, room=sid)
            return False

    async def disconnect(self, sid: str):
        """Handle user disconnection"""
        if sid in self.active_connections:
            user_id = self.active_connections[sid]['user_id']
            logger.info(f"👋 User {user_id} disconnected")
            del self.active_connections[sid]

    async def join_room(self, sid: str, room: str):
        """Join a room (conversation)"""
        if sid not in self.active_connections:
            return
        
        user_id = self.active_connections[sid]['user_id']
        
        if room not in self.user_rooms:
            self.user_rooms[room] = []
        
        if sid not in self.user_rooms[room]:
            self.user_rooms[room].append(sid)
            await sio.enter_room(sid, room)
            logger.info(f"✅ User {user_id} joined room {room}")

    async def leave_room(self, sid: str, room: str):
        """Leave a room"""
        if sid in self.user_rooms.get(room, []):
            self.user_rooms[room].remove(sid)
            await sio.leave_room(sid, room)

    async def send_to_room(self, room: str, event: str, data: Any):
        """Send event to all users in a room"""
        await sio.emit(event, data, room=room)

    async def send_to_user(self, user_id: str, event: str, data: Any):
        """Send event to a specific user"""
        for sid, conn in self.active_connections.items():
            if conn['user_id'] == user_id:
                await sio.emit(event, data, room=sid)

manager = SocketManager()

# ============================================
# SOCKET.IO EVENT HANDLERS
# ============================================

@sio.event
async def connect(sid, environ, auth):
    """Handle connection event"""
    logger.info(f"🔌 New connection attempt: {sid}")

    # Token is normally sent via the client's `auth` option (socket.io-client:
    # io(url, { auth: { token } })). Fall back to the query string for clients
    # that pass it as ?token=... instead.
    token = auth.get('token') if isinstance(auth, dict) else None

    if not token:
        query_string = environ.get('QUERY_STRING', '')
        for param in query_string.split('&'):
            if param.startswith('token='):
                token = param.split('=')[1]
                break

    if not token:
        await sio.emit('error', {'message': 'Authentication required'}, room=sid)
        await sio.disconnect(sid)
        return
    
    success = await manager.connect(sid, token)
    if not success:
        await sio.disconnect(sid)

@sio.event
async def disconnect(sid):
    """Handle disconnection event"""
    await manager.disconnect(sid)

@sio.event
async def join_room(sid, data):
    """Join a conversation room"""
    room = data.get('room')
    if room:
        await manager.join_room(sid, room)

@sio.event
async def leave_room(sid, data):
    """Leave a conversation room"""
    room = data.get('room')
    if room:
        await manager.leave_room(sid, room)

@sio.event
async def send_message(sid, data):
    """Handle sending a message via WebSocket"""
    if sid not in manager.active_connections:
        await sio.emit('error', {'message': 'Not authenticated'}, room=sid)
        return
    
    user_id = manager.active_connections[sid]['user_id']
    conversation_id = data.get('conversation_id')
    content = data.get('content')
    message_type = data.get('type', 'text')
    
    if not conversation_id or not content:
        await sio.emit('error', {'message': 'Missing required fields'}, room=sid)
        return
    
    try:
        # Save message to database
        async with AsyncSessionLocal() as db:
            service = ChatService(db)
            
            # Create message in database
            from app.schemas.chat import MessageCreate
            message_data = MessageCreate(
                conversation_id=conversation_id,
                content=content,
                type=message_type
            )
            message = await service.send_message(user_id, message_data)
            
            # Get sender info
            from app.models.user import User
            user_result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()
            avatar_url = await service._get_avatar_url(user_id, user.role) if user else None

            # Prepare response
            response = {
                'id': str(message.id),
                'conversation_id': str(message.conversation_id),
                'sender_id': str(message.sender_id),
                'sender_username': user.username if user else 'Unknown',
                'sender_avatar': avatar_url,
                'content': message.content,
                'type': message.type,
                'is_read': message.is_read,
                'created_at': message.created_at.isoformat() if message.created_at else None,
                'updated_at': message.updated_at.isoformat() if message.updated_at else None
            }
            
            # Broadcast to conversation room
            room = f"conversation_{conversation_id}"
            await manager.send_to_room(room, 'new_message', response)
            
            # Notify all participants (for notifications)
            participants = await service.get_conversation_participants(conversation_id)
            for participant in participants:
                if str(participant.id) != user_id:
                    await manager.send_to_user(
                        str(participant.id),
                        'new_message_notification',
                        {
                            'conversation_id': conversation_id,
                            'message': response,
                            'sender': user.username if user else 'Unknown'
                        }
                    )
            
    except Exception as e:
        logger.error(f"❌ Error sending message: {e}")
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def typing(sid, data):
    """Handle typing indicator"""
    if sid not in manager.active_connections:
        return
    
    user_id = manager.active_connections[sid]['user_id']
    conversation_id = data.get('conversation_id')
    is_typing = data.get('is_typing', False)
    
    if conversation_id:
        room = f"conversation_{conversation_id}"
        await manager.send_to_room(
            room,
            'user_typing',
            {
                'user_id': user_id,
                'conversation_id': conversation_id,
                'is_typing': is_typing
            }
        )

@sio.event
async def mark_read(sid, data):
    """Mark messages as read"""
    if sid not in manager.active_connections:
        return
    
    user_id = manager.active_connections[sid]['user_id']
    conversation_id = data.get('conversation_id')
    
    if not conversation_id:
        return
    
    try:
        async with AsyncSessionLocal() as db:
            from sqlalchemy import update
            from app.models.conversation import Message
            
            await db.execute(
                update(Message)
                .where(
                    Message.conversation_id == conversation_id,
                    Message.sender_id != user_id,
                    Message.is_read == False
                )
                .values(is_read=True, read_at=datetime.utcnow())
            )
            await db.commit()
            
            # Notify others that messages were read
            room = f"conversation_{conversation_id}"
            await manager.send_to_room(
                room,
                'messages_read',
                {
                    'conversation_id': conversation_id,
                    'user_id': user_id
                }
            )
    except Exception as e:
        logger.error(f"❌ Error marking messages as read: {e}")