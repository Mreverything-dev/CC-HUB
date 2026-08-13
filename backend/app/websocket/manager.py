# backend/app/websocket/manager.py
import socketio
from typing import Dict, List, Any
import logging
from fastapi import HTTPException
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
        # Livestream signaling state: which sid is broadcasting a given
        # stream, and which sids are currently watching it. Kept in-memory
        # since it only matters for the lifetime of the live connection.
        self.stream_hosts: Dict[str, str] = {}  # stream_id -> host sid
        self.stream_viewers: Dict[str, set] = {}  # stream_id -> {viewer sid, ...}

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
            await self._touch_last_seen(user_id)
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
            # Only stamp last_seen if the user has no other active connections
            # (e.g. multiple tabs) left.
            if not any(c['user_id'] == user_id for c in self.active_connections.values()):
                await self._touch_last_seen(user_id)

        await self.cleanup_stream_connection(sid)

    async def _touch_last_seen(self, user_id: str):
        """Persist a fresh last_seen timestamp for a user - best effort."""
        try:
            from app.models.user import User
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(User).where(User.id == user_id).values(last_seen=datetime.utcnow())
                )
                await db.commit()
        except Exception as e:
            logger.error(f"❌ Failed to update last_seen for {user_id}: {e}")

    def get_online_user_ids(self) -> set:
        """User IDs with at least one active WebSocket connection right now."""
        return {conn['user_id'] for conn in self.active_connections.values()}

    async def cleanup_stream_connection(self, sid: str):
        """Tear down any livestream host/viewer state held by this sid"""
        # If this sid was hosting a stream, tell every viewer the host is gone.
        for stream_id, host_sid in list(self.stream_hosts.items()):
            if host_sid == sid:
                del self.stream_hosts[stream_id]
                await self.send_to_room(f"stream_{stream_id}", 'stream:host_left', {'stream_id': stream_id})
                logger.info(f"📡 Host disconnected from stream {stream_id}")

        # If this sid was viewing any stream(s), remove it and tell the host.
        for stream_id, viewers in list(self.stream_viewers.items()):
            if sid in viewers:
                viewers.discard(sid)
                host_sid = self.stream_hosts.get(stream_id)
                if host_sid:
                    await sio.emit('stream:viewer_left', {'viewer_sid': sid}, room=host_sid)

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
    media_url = data.get('media_url')
    media_name = data.get('media_name')

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
                type=message_type,
                media_url=media_url,
                media_name=media_name
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
                'media_url': message.media_url,
                'media_name': message.media_name,
                'reactions': [],
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

@sio.on('message:react')
async def message_react(sid, data):
    """Add/change/remove the caller's reaction on a message - broadcasts the
    resulting per-message reaction state to the conversation room so every
    client viewing it updates in real time. Reuses this same Socket.IO
    connection (no new WS infrastructure), mirroring stream:comment_react."""
    if sid not in manager.active_connections:
        await sio.emit('error', {'message': 'Not authenticated'}, room=sid)
        return

    user_id = manager.active_connections[sid]['user_id']
    message_id = data.get('message_id')
    reaction = data.get('reaction')
    if not message_id or not reaction:
        await sio.emit('error', {'message': 'Missing required fields'}, room=sid)
        return

    try:
        async with AsyncSessionLocal() as db:
            service = ChatService(db)
            result = await service.react_to_message(message_id, user_id, reaction)

        room = f"conversation_{result['conversation_id']}"
        await manager.send_to_room(room, 'message:reaction', result)
    except HTTPException as e:
        await sio.emit('error', {'message': e.detail}, room=sid)
    except Exception as e:
        logger.error(f"❌ Error reacting to message: {e}")
        await sio.emit('error', {'message': 'Unable to react to that message.'}, room=sid)

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

# ============================================
# LIVESTREAM SIGNALING (WebRTC offer/answer/ICE relay + live chat)
# ============================================
# The host opens one RTCPeerConnection per viewer. This server never touches
# media itself - it only relays SDP/ICE payloads between the two socket ids
# involved, and enforces (via LivestreamService, against the DB) that only
# the actual host can broadcast and only authorized viewers can join/watch/
# chat. Visibility/section checks always run here, never trusting the client.

def _stream_room(stream_id: str) -> str:
    return f"stream_{stream_id}"

@sio.on('stream:host_start')
async def stream_host_start(sid, data):
    """Host announces it is broadcasting a stream - verified against the DB."""
    if sid not in manager.active_connections:
        return
    user_id = manager.active_connections[sid]['user_id']
    stream_id = data.get('stream_id')
    if not stream_id:
        return

    try:
        async with AsyncSessionLocal() as db:
            from app.services.livestream_service import LivestreamService
            from app.models.livestream import Livestream

            result = await db.execute(select(Livestream).where(Livestream.id == stream_id))
            stream = result.scalar_one_or_none()
            if not stream or str(stream.host_id) != user_id:
                await sio.emit('stream:error', {'message': 'You are not the host of this stream'}, room=sid)
                return

        manager.stream_hosts[stream_id] = sid
        manager.stream_viewers.setdefault(stream_id, set())
        await sio.enter_room(sid, _stream_room(stream_id))
        logger.info(f"📡 Host {user_id} started broadcasting stream {stream_id}")

        # Tell the host about any viewers who already joined the room while
        # nobody was broadcasting yet (or reconnected), reusing the same
        # event/payload shape as a live join so the existing
        # stream:viewer_ready handler on the host just sends them an offer.
        for viewer_sid in manager.stream_viewers.get(stream_id, set()):
            await sio.emit(
                'stream:viewer_ready',
                {'stream_id': stream_id, 'viewer_sid': viewer_sid},
                room=sid,
            )
    except Exception as e:
        logger.error(f"❌ Error starting stream host: {e}")
        await sio.emit('stream:error', {'message': str(e)}, room=sid)

@sio.on('stream:viewer_join')
async def stream_viewer_join(sid, data):
    """Viewer requests to watch a stream - visibility/section access enforced here."""
    if sid not in manager.active_connections:
        await sio.emit('stream:error', {'code': 'NOT_AUTHENTICATED', 'message': 'Not authenticated'}, room=sid)
        return

    user_id = manager.active_connections[sid]['user_id']
    stream_id = data.get('stream_id')
    if not stream_id:
        return

    # Idempotent: if this sid already joined this stream (duplicate/retry
    # call, reconnect race, etc.), don't re-run authorization or re-notify
    # the host - that would make the host spin up a second, orphaned
    # RTCPeerConnection for the same viewer instead of reusing the one
    # already being negotiated.
    if sid in manager.stream_viewers.get(stream_id, set()):
        await sio.emit('stream:viewer_joined', {'stream_id': stream_id}, room=sid)
        return

    try:
        async with AsyncSessionLocal() as db:
            from app.services.livestream_service import LivestreamService
            from app.models.user import User

            service = LivestreamService(db)
            allowed = await service.can_view_stream(user_id, stream_id)
            if not allowed:
                await sio.emit(
                    'stream:error',
                    {'code': 'PERMISSION_DENIED', 'message': "You don't have permission to view this stream"},
                    room=sid,
                )
                return

            user_result = await db.execute(select(User).where(User.id == user_id))
            user = user_result.scalar_one_or_none()

        manager.stream_viewers.setdefault(stream_id, set()).add(sid)
        await sio.enter_room(sid, _stream_room(stream_id))
        logger.info(f"👁️ Viewer {user_id} joined stream {stream_id}")

        host_sid = manager.stream_hosts.get(stream_id)
        if host_sid:
            await sio.emit(
                'stream:viewer_ready',
                {
                    'stream_id': stream_id,
                    'viewer_sid': sid,
                    'user_id': user_id,
                    'username': user.username if user else 'Unknown',
                },
                room=host_sid,
            )
            await sio.emit('stream:viewer_joined', {'stream_id': stream_id}, room=sid)
        else:
            # Not an error condition - the viewer is validated and registered
            # (see stream_host_start's catch-up loop), just waiting for the
            # host to actually start broadcasting.
            await sio.emit(
                'stream:error',
                {'code': 'HOST_OFFLINE', 'message': 'Host is not currently broadcasting yet.'},
                room=sid,
            )
    except Exception:
        # logger.exception() includes the full traceback - never send that
        # detail to the client, only a generic, frontend-safe error.
        logger.exception(f"❌ stream:viewer_join failed for user={user_id} stream={stream_id}")
        manager.stream_viewers.get(stream_id, set()).discard(sid)
        await sio.emit(
            'stream:error',
            {'code': 'STREAM_VIEWER_JOIN_FAILED', 'message': 'Unable to join the livestream.'},
            room=sid,
        )

@sio.on('stream:leave')
async def stream_leave(sid, data):
    """Viewer stops watching a stream"""
    stream_id = data.get('stream_id')
    if not stream_id:
        return
    manager.stream_viewers.get(stream_id, set()).discard(sid)
    await sio.leave_room(sid, _stream_room(stream_id))
    host_sid = manager.stream_hosts.get(stream_id)
    if host_sid:
        await sio.emit('stream:viewer_left', {'viewer_sid': sid}, room=host_sid)

@sio.on('stream:offer')
async def stream_offer(sid, data):
    """Relay a host's SDP offer to one specific viewer"""
    stream_id = data.get('stream_id')
    target_sid = data.get('target_sid')
    sdp = data.get('sdp')
    if not stream_id or not target_sid or not sdp:
        return
    # Only the verified host of this stream may send offers.
    if manager.stream_hosts.get(stream_id) != sid:
        await sio.emit('stream:error', {'message': 'Not authorized to broadcast this stream'}, room=sid)
        return
    await sio.emit('stream:offer', {'stream_id': stream_id, 'host_sid': sid, 'sdp': sdp}, room=target_sid)

@sio.on('stream:answer')
async def stream_answer(sid, data):
    """Relay a viewer's SDP answer back to the host"""
    stream_id = data.get('stream_id')
    sdp = data.get('sdp')
    if not stream_id or not sdp:
        return
    # Only a verified, joined viewer of this stream may answer.
    if sid not in manager.stream_viewers.get(stream_id, set()):
        await sio.emit('stream:error', {'message': 'Not a recognized viewer of this stream'}, room=sid)
        return
    host_sid = manager.stream_hosts.get(stream_id)
    if host_sid:
        await sio.emit('stream:answer', {'stream_id': stream_id, 'viewer_sid': sid, 'sdp': sdp}, room=host_sid)

@sio.on('stream:ice_candidate')
async def stream_ice_candidate(sid, data):
    """Relay an ICE candidate between host and viewer"""
    stream_id = data.get('stream_id')
    target_sid = data.get('target_sid')
    candidate = data.get('candidate')
    if not stream_id or not target_sid or not candidate:
        return
    is_host = manager.stream_hosts.get(stream_id) == sid
    is_viewer = sid in manager.stream_viewers.get(stream_id, set())
    if not is_host and not is_viewer:
        return
    await sio.emit('stream:ice_candidate', {'stream_id': stream_id, 'from_sid': sid, 'candidate': candidate}, room=target_sid)

@sio.on('stream:chat_message')
async def stream_chat_message(sid, data):
    """Live chat message (or reply, when parent_comment_id is set) for a
    stream - persisted, then broadcast to host + all viewers."""
    if sid not in manager.active_connections:
        return
    user_id = manager.active_connections[sid]['user_id']
    stream_id = data.get('stream_id')
    message = data.get('message')
    parent_comment_id = data.get('parent_comment_id')
    if not stream_id or not message:
        return

    is_host = manager.stream_hosts.get(stream_id) == sid
    is_viewer = sid in manager.stream_viewers.get(stream_id, set())
    if not is_host and not is_viewer:
        await sio.emit('stream:error', {'code': 'NOT_JOINED', 'message': 'Join the stream before chatting'}, room=sid)
        return

    try:
        async with AsyncSessionLocal() as db:
            from app.services.stream_comment_service import StreamCommentService

            service = StreamCommentService(db)
            comment = await service.create_comment(stream_id, user_id, message, parent_comment_id)

        await sio.emit('stream:chat_message', comment, room=_stream_room(stream_id))
    except HTTPException as e:
        await sio.emit('stream:error', {'code': 'COMMENT_FAILED', 'message': e.detail}, room=sid)
    except Exception:
        logger.exception(f"❌ Error sending stream chat message: user={user_id} stream={stream_id}")
        await sio.emit('stream:error', {'code': 'COMMENT_FAILED', 'message': 'Unable to send your message.'}, room=sid)

@sio.on('stream:comment_react')
async def stream_comment_react(sid, data):
    """Add/change/remove the caller's reaction on a comment - broadcasts the
    resulting per-user reaction state so every client can update its own
    local aggregate (see useLiveStreamSignaling on the frontend)."""
    if sid not in manager.active_connections:
        return
    user_id = manager.active_connections[sid]['user_id']
    stream_id = data.get('stream_id')
    comment_id = data.get('comment_id')
    reaction = data.get('reaction')
    if not stream_id or not comment_id or not reaction:
        return

    is_host = manager.stream_hosts.get(stream_id) == sid
    is_viewer = sid in manager.stream_viewers.get(stream_id, set())
    if not is_host and not is_viewer:
        await sio.emit('stream:error', {'code': 'NOT_JOINED', 'message': 'Join the stream before reacting'}, room=sid)
        return

    try:
        async with AsyncSessionLocal() as db:
            from app.services.stream_comment_service import StreamCommentService

            service = StreamCommentService(db)
            result = await service.react_to_comment(comment_id, user_id, reaction)

        await sio.emit('stream:comment_reaction', result, room=_stream_room(stream_id))
    except HTTPException as e:
        await sio.emit('stream:error', {'code': 'REACTION_FAILED', 'message': e.detail}, room=sid)
    except Exception:
        logger.exception(f"❌ Error reacting to comment: user={user_id} comment={comment_id}")
        await sio.emit('stream:error', {'code': 'REACTION_FAILED', 'message': 'Unable to react to that comment.'}, room=sid)

@sio.on('stream:comment_delete')
async def stream_comment_delete(sid, data):
    """Delete (soft) a comment - only the comment's author or the stream
    host may do this, enforced in StreamCommentService.delete_comment."""
    if sid not in manager.active_connections:
        return
    user_id = manager.active_connections[sid]['user_id']
    stream_id = data.get('stream_id')
    comment_id = data.get('comment_id')
    if not stream_id or not comment_id:
        return

    try:
        async with AsyncSessionLocal() as db:
            from app.services.stream_comment_service import StreamCommentService

            service = StreamCommentService(db)
            result = await service.delete_comment(comment_id, user_id)

        await sio.emit('stream:comment_deleted', result, room=_stream_room(stream_id))
    except HTTPException as e:
        await sio.emit('stream:error', {'code': 'DELETE_FAILED', 'message': e.detail}, room=sid)
    except Exception:
        logger.exception(f"❌ Error deleting comment: user={user_id} comment={comment_id}")
        await sio.emit('stream:error', {'code': 'DELETE_FAILED', 'message': 'Unable to delete that comment.'}, room=sid)
