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


async def _reject_if_restricted(sid: str, user_id: str, event: str = 'error') -> bool:
    """Shared restriction gate for every WebSocket handler that creates a
    social/interaction row (chat messages, livestream comments/reactions) -
    mirrors get_current_unrestricted_user's REST-side check, since these
    handlers never go through a FastAPI Depends() chain. Returns True (and
    emits `event` the caller should treat as "stop, don't proceed") when
    the user currently has an active restriction; False otherwise. `event`
    lets callers match their own existing error-event convention (chat uses
    plain 'error', the livestream handlers use 'stream:error')."""
    from app.services.moderation_service import ModerationService
    async with AsyncSessionLocal() as db:
        service = ModerationService(db)
        restriction = await service.get_active_restriction(user_id)
    if restriction:
        until = restriction.restricted_until.strftime("%b %d, %Y %I:%M %p UTC")
        payload = {'message': f"Your account is temporarily restricted from this action until {until}."}
        if event == 'stream:error':
            payload = {'code': 'RESTRICTED', **payload}
        await sio.emit(event, payload, room=sid)
        return True
    return False

class SocketManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, Any]] = {}
        self.user_rooms: Dict[str, List[str]] = {}
        # Livestream signaling state: which sid is broadcasting a given
        # stream, and which sids are currently watching it. Kept in-memory
        # since it only matters for the lifetime of the live connection.
        self.stream_hosts: Dict[str, str] = {}  # stream_id -> host sid
        self.stream_viewers: Dict[str, set] = {}  # stream_id -> {viewer sid, ...}
        # Meethub mesh: user_ids removed from a session by its organizer,
        # in-memory and session-lifetime only (mirrors stream_hosts/
        # stream_viewers above) - stream_viewer_join rejects a rejoin attempt
        # from anyone in this set for that stream_id. A no-op for every
        # plain livestream, which never populates this dict.
        self.meeting_kicked: Dict[str, set] = {}  # stream_id -> {user_id, ...}
        # Meethub single-presenter lock: at most one person's screen may be
        # the active presentation per stream at a time. In-memory,
        # session-lifetime only, same as the three dicts above - a no-op for
        # every plain livestream, which never populates this dict. Camera/
        # mic are NOT gated by this - only screen share.
        self.meeting_presenters: Dict[str, dict] = {}  # stream_id -> {"user_id", "username", "sid"}

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

            if payload.get('type') != 'access':
                await sio.emit('error', {'message': 'Invalid token type'}, room=sid)
                return False

            # Cached once per connection so livestream join/leave system
            # messages (and anything else that wants a display name) don't
            # need a fresh DB lookup on every event - best effort, a failed
            # lookup just falls back to a generic label later.
            username = None
            try:
                from app.models.user import User
                async with AsyncSessionLocal() as db:
                    result = await db.execute(select(User.username).where(User.id == user_id))
                    username = result.scalar_one_or_none()
            except Exception as e:
                logger.error(f"❌ Failed to look up username for {user_id}: {e}")

            self.active_connections[sid] = {
                'user_id': user_id,
                'username': username,
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
        username = None
        if sid in self.active_connections:
            user_id = self.active_connections[sid]['user_id']
            username = self.active_connections[sid].get('username')
            logger.info(f"👋 User {user_id} disconnected")
            del self.active_connections[sid]
            # Only stamp last_seen if the user has no other active connections
            # (e.g. multiple tabs) left.
            if not any(c['user_id'] == user_id for c in self.active_connections.values()):
                await self._touch_last_seen(user_id)

        await self.cleanup_stream_connection(sid, username)

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

    async def cleanup_stream_connection(self, sid: str, username: str = None):
        """Tear down any livestream host/viewer state held by this sid"""
        # If this sid was hosting a stream, tell every viewer the host is gone.
        for stream_id, host_sid in list(self.stream_hosts.items()):
            if host_sid == sid:
                del self.stream_hosts[stream_id]
                await self.send_to_room(f"stream_{stream_id}", 'stream:host_left', {'stream_id': stream_id})
                logger.info(f"📡 Host disconnected from stream {stream_id}")

        # If this sid was viewing any stream(s), remove it, tell the host,
        # and post a "left" system message to the room's chat - mirrors the
        # explicit stream:leave handler below so a tab close/disconnect
        # announces a leave exactly like a deliberate Leave Live click does.
        for stream_id, viewers in list(self.stream_viewers.items()):
            if sid in viewers:
                viewers.discard(sid)
                host_sid = self.stream_hosts.get(stream_id)
                if host_sid:
                    await sio.emit('stream:viewer_left', {'viewer_sid': sid}, room=host_sid)
                await sio.emit(
                    'stream:system_message',
                    {
                        'stream_id': stream_id,
                        'message': f"{username or 'A viewer'} left the live.",
                        'timestamp': datetime.utcnow().isoformat(),
                    },
                    room=f"stream_{stream_id}",
                )
                # Meethub mesh: a no-op for every plain livestream (nothing
                # subscribes to this event there) - tells remaining
                # participants to close their one peer connection to this sid.
                await sio.emit(
                    'meeting:mesh_peer_left',
                    {'stream_id': stream_id, 'sid': sid},
                    room=f"stream_{stream_id}",
                )
                # Meethub: an abrupt disconnect while presenting must free
                # the presenter lock - otherwise the slot stays stuck until
                # someone else forces it, even though nobody is actually
                # sharing anything anymore. A no-op for every plain
                # livestream/non-presenting viewer.
                if self.meeting_presenters.get(stream_id, {}).get('sid') == sid:
                    del self.meeting_presenters[stream_id]
                    await sio.emit(
                        'meeting:presenter_changed',
                        {'stream_id': stream_id, 'presenter_user_id': None, 'presenter_username': None, 'presenter_sid': None},
                        room=f"stream_{stream_id}",
                    )

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

async def _is_conversation_member(user_id: str, conversation_id: str) -> bool:
    """Shared membership guard for the chat socket handlers below - mirrors
    the same check ChatService.send_message/get_conversation_messages
    already enforce on the REST path, so a user can't join a conversation's
    room, receive its typing indicators, or bulk-mark it read unless they're
    actually a member of it."""
    from app.models.conversation import ConversationMember
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none() is not None

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
    if not room:
        return

    if room.startswith('conversation_'):
        if sid not in manager.active_connections:
            return
        user_id = manager.active_connections[sid]['user_id']
        conversation_id = room[len('conversation_'):]
        if not await _is_conversation_member(user_id, conversation_id):
            return

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
    if await _reject_if_restricted(sid, user_id):
        return

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
                'is_deleted': message.is_deleted,
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

@sio.on('message:unsend')
async def message_unsend(sid, data):
    """'Unsend' a message the caller sent - soft-deletes it (content/media
    wiped, row kept) and broadcasts the resulting state to the conversation
    room so every participant's view updates in real time. ChatService.
    unsend_message is what actually enforces sender-only (403 otherwise);
    this handler only re-resolves the caller's identity from the
    authenticated connection, same as every other handler here - never from
    client-supplied data."""
    if sid not in manager.active_connections:
        await sio.emit('error', {'message': 'Not authenticated'}, room=sid)
        return

    user_id = manager.active_connections[sid]['user_id']
    message_id = data.get('message_id')
    if not message_id:
        await sio.emit('error', {'message': 'Missing required fields'}, room=sid)
        return

    try:
        async with AsyncSessionLocal() as db:
            service = ChatService(db)
            result = await service.unsend_message(message_id, user_id)

        room = f"conversation_{result['conversation_id']}"
        await manager.send_to_room(room, 'message:unsent', {
            'message_id': result['message_id'],
            'conversation_id': result['conversation_id'],
            'is_deleted': True,
            'content': '',
            'media_url': None,
            'media_name': None,
        })
    except HTTPException as e:
        await sio.emit('error', {'message': e.detail}, room=sid)
    except Exception as e:
        logger.error(f"❌ Error unsending message: {e}")
        await sio.emit('error', {'message': 'Unable to unsend that message.'}, room=sid)

@sio.event
async def typing(sid, data):
    """Handle typing indicator"""
    if sid not in manager.active_connections:
        return
    
    user_id = manager.active_connections[sid]['user_id']
    conversation_id = data.get('conversation_id')
    is_typing = data.get('is_typing', False)

    if conversation_id and await _is_conversation_member(user_id, conversation_id):
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

    if not await _is_conversation_member(user_id, conversation_id):
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

    # Meethub: a user removed by the organizer this session can't rejoin it.
    # A no-op set for every plain livestream.
    if user_id in manager.meeting_kicked.get(stream_id, set()):
        await sio.emit(
            'stream:error',
            {'code': 'REMOVED_FROM_MEETING', 'message': 'You were removed from this meeting.'},
            room=sid,
        )
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
            from app.models.meethub import MeethubSession

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

            meethub_result = await db.execute(
                select(MeethubSession).where(MeethubSession.livestream_id == stream_id)
            )
            is_meethub = meethub_result.scalar_one_or_none() is not None

        # Meethub mesh: snapshot who's already in the room BEFORE adding this
        # sid, so the new joiner knows exactly who to open a peer connection
        # + send an offer to (new-joiner-initiates convention - existing
        # participants just wait for that offer). A no-op for every plain
        # livestream (is_meethub is False, nothing emitted here).
        existing_peers = []
        if is_meethub:
            for peer_sid in manager.stream_viewers.get(stream_id, set()):
                peer_conn = manager.active_connections.get(peer_sid)
                if peer_conn:
                    existing_peers.append(
                        {'sid': peer_sid, 'user_id': peer_conn['user_id'], 'username': peer_conn.get('username')}
                    )

        manager.stream_viewers.setdefault(stream_id, set()).add(sid)
        await sio.enter_room(sid, _stream_room(stream_id))
        logger.info(f"👁️ Viewer {user_id} joined stream {stream_id}")

        if is_meethub:
            await sio.emit('meeting:mesh_peers', {'stream_id': stream_id, 'peers': existing_peers}, room=sid)
            await sio.emit(
                'meeting:mesh_peer_joined',
                {'stream_id': stream_id, 'sid': sid, 'user_id': user_id, 'username': user.username if user else None},
                room=_stream_room(stream_id),
                skip_sid=sid,
            )
            # Catch the new joiner up on whoever's already presenting, if
            # anyone - reuses the exact same event the live broadcast uses,
            # so the client only needs one meeting:presenter_changed handler.
            current_presenter = manager.meeting_presenters.get(stream_id)
            if current_presenter:
                await sio.emit(
                    'meeting:presenter_changed',
                    {
                        'stream_id': stream_id,
                        'presenter_user_id': current_presenter['user_id'],
                        'presenter_username': current_presenter['username'],
                        'presenter_sid': current_presenter['sid'],
                    },
                    room=sid,
                )

        # Announced once per genuine join - the idempotent early-return above
        # (already-joined sid) means a retry/reconnect race never double-posts.
        await sio.emit(
            'stream:system_message',
            {
                'stream_id': stream_id,
                'message': f"{user.username if user else 'A viewer'} joined the live.",
                'timestamp': datetime.utcnow().isoformat(),
            },
            room=_stream_room(stream_id),
        )

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
    """Viewer stops watching a stream (explicit Leave Live click, or the
    signaling hook's own unmount/teardown)."""
    stream_id = data.get('stream_id')
    if not stream_id:
        return
    was_viewer = sid in manager.stream_viewers.get(stream_id, set())
    manager.stream_viewers.get(stream_id, set()).discard(sid)
    await sio.leave_room(sid, _stream_room(stream_id))
    host_sid = manager.stream_hosts.get(stream_id)
    if host_sid:
        await sio.emit('stream:viewer_left', {'viewer_sid': sid}, room=host_sid)
    # Only announce a leave for a sid that was actually a registered viewer -
    # keeps a redundant/duplicate stream:leave call (already left, or never
    # joined) silent instead of posting a spurious "left the live." message.
    if was_viewer:
        username = manager.active_connections.get(sid, {}).get('username') or 'A viewer'
        await sio.emit(
            'stream:system_message',
            {
                'stream_id': stream_id,
                'message': f"{username} left the live.",
                'timestamp': datetime.utcnow().isoformat(),
            },
            room=_stream_room(stream_id),
        )
        # Meethub mesh: a no-op for every plain livestream (nothing
        # subscribes to this event there).
        await sio.emit('meeting:mesh_peer_left', {'stream_id': stream_id, 'sid': sid}, room=_stream_room(stream_id))

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

# ============================================
# MEETHUB MESH SIGNALING (WebRTC offer/answer/ICE relay, N-to-N)
# ============================================
# Every Meethub participant opens a direct peer connection to every other
# participant (mesh) - unlike the single-host Livestream signaling above,
# there's no host/viewer distinction here: both sides of a relay just need
# to already be a registered viewer of the stream (see stream:viewer_join,
# reused unchanged for room membership/permission/chat-authorization). The
# server still never touches media, only relays SDP/ICE between the two sids.

def _is_registered_viewer(stream_id: str, sid: str) -> bool:
    return sid in manager.stream_viewers.get(stream_id, set())

@sio.on('meeting:mesh_offer')
async def meeting_mesh_offer(sid, data):
    """Relay an SDP offer from one mesh participant to another."""
    stream_id = data.get('stream_id')
    target_sid = data.get('target_sid')
    sdp = data.get('sdp')
    if not stream_id or not target_sid or not sdp:
        return
    if not _is_registered_viewer(stream_id, sid) or not _is_registered_viewer(stream_id, target_sid):
        await sio.emit('stream:error', {'message': 'Not a recognized participant of this meeting'}, room=sid)
        return
    await sio.emit('meeting:mesh_offer', {'stream_id': stream_id, 'from_sid': sid, 'sdp': sdp}, room=target_sid)

@sio.on('meeting:mesh_answer')
async def meeting_mesh_answer(sid, data):
    """Relay an SDP answer from one mesh participant back to another."""
    stream_id = data.get('stream_id')
    target_sid = data.get('target_sid')
    sdp = data.get('sdp')
    if not stream_id or not target_sid or not sdp:
        return
    if not _is_registered_viewer(stream_id, sid) or not _is_registered_viewer(stream_id, target_sid):
        await sio.emit('stream:error', {'message': 'Not a recognized participant of this meeting'}, room=sid)
        return
    await sio.emit('meeting:mesh_answer', {'stream_id': stream_id, 'from_sid': sid, 'sdp': sdp}, room=target_sid)

@sio.on('meeting:mesh_ice_candidate')
async def meeting_mesh_ice_candidate(sid, data):
    """Relay an ICE candidate between two mesh participants."""
    stream_id = data.get('stream_id')
    target_sid = data.get('target_sid')
    candidate = data.get('candidate')
    if not stream_id or not target_sid or not candidate:
        return
    if not _is_registered_viewer(stream_id, sid) or not _is_registered_viewer(stream_id, target_sid):
        return
    await sio.emit(
        'meeting:mesh_ice_candidate', {'stream_id': stream_id, 'from_sid': sid, 'candidate': candidate}, room=target_sid
    )

async def _require_organizer_sid(sid: str, stream_id: str):
    """Returns (user_id, session) if sid's user is the Meethub organizer of
    this stream, else emits an error and returns (None, None)."""
    if sid not in manager.active_connections:
        return None, None
    user_id = manager.active_connections[sid]['user_id']
    async with AsyncSessionLocal() as db:
        from app.models.meethub import MeethubSession

        result = await db.execute(select(MeethubSession).where(MeethubSession.livestream_id == stream_id))
        session = result.scalar_one_or_none()
    if not session or str(session.organizer_id) != user_id:
        await sio.emit('stream:error', {'message': 'Only the meeting organizer can do this'}, room=sid)
        return None, None
    return user_id, session

def _sids_for_user(stream_id: str, target_user_id: str):
    return [
        peer_sid
        for peer_sid in manager.stream_viewers.get(stream_id, set())
        if manager.active_connections.get(peer_sid, {}).get('user_id') == target_user_id
    ]

@sio.on('meeting:force_mute')
async def meeting_force_mute(sid, data):
    """Organizer-only: ask a participant's own client to disable its mic.
    Best-effort/cooperative - there's no SFU to silence someone else's
    outgoing audio at the media layer without their client's cooperation."""
    stream_id = data.get('stream_id')
    target_user_id = data.get('target_user_id')
    if not stream_id or not target_user_id:
        return
    organizer_id, _ = await _require_organizer_sid(sid, stream_id)
    if not organizer_id:
        return
    for target_sid in _sids_for_user(stream_id, target_user_id):
        await sio.emit('meeting:force_muted', {'stream_id': stream_id}, room=target_sid)

@sio.on('meeting:remove_participant')
async def meeting_remove_participant(sid, data):
    """Organizer-only: disconnect a participant from this meeting and block
    them from rejoining it for the rest of the session (manager.meeting_kicked,
    in-memory - same lifetime guarantee as stream_hosts/stream_viewers)."""
    stream_id = data.get('stream_id')
    target_user_id = data.get('target_user_id')
    if not stream_id or not target_user_id:
        return
    organizer_id, session = await _require_organizer_sid(sid, stream_id)
    if not organizer_id:
        return
    if target_user_id == str(session.organizer_id):
        await sio.emit('stream:error', {'message': "You can't remove yourself"}, room=sid)
        return

    manager.meeting_kicked.setdefault(stream_id, set()).add(target_user_id)
    for target_sid in _sids_for_user(stream_id, target_user_id):
        manager.stream_viewers.get(stream_id, set()).discard(target_sid)
        await sio.emit('meeting:removed', {'stream_id': stream_id}, room=target_sid)
        await sio.leave_room(target_sid, _stream_room(stream_id))
        await sio.emit('meeting:mesh_peer_left', {'stream_id': stream_id, 'sid': target_sid}, room=_stream_room(stream_id))

@sio.on('meeting:request_present')
async def meeting_request_present(sid, data):
    """Claim the single presenter slot for this meeting, if free (or already
    ours). Screen sharing only - camera/mic are never gated by this. The
    check-and-set below happens with no `await` in between, which is what
    makes it race-safe: asyncio is cooperative/single-threaded, so nothing
    can interleave between two synchronous statements in the same handler
    invocation, even if two clients' requests arrive back to back."""
    stream_id = data.get('stream_id')
    if not stream_id:
        return
    if not _is_registered_viewer(stream_id, sid):
        await sio.emit('stream:error', {'message': 'Not a recognized participant of this meeting'}, room=sid)
        return
    user_id = manager.active_connections[sid]['user_id']
    username = manager.active_connections[sid].get('username')

    current = manager.meeting_presenters.get(stream_id)
    granted = not current or current['user_id'] == user_id
    if granted:
        manager.meeting_presenters[stream_id] = {'user_id': user_id, 'username': username, 'sid': sid}

    await sio.emit(
        'meeting:present_response',
        {'granted': granted, 'presenter_user_id': user_id if granted else current['user_id'],
         'presenter_username': username if granted else current['username']},
        room=sid,
    )
    if granted:
        await sio.emit(
            'meeting:presenter_changed',
            {'stream_id': stream_id, 'presenter_user_id': user_id, 'presenter_username': username, 'presenter_sid': sid},
            room=_stream_room(stream_id),
        )

@sio.on('meeting:stop_presenting')
async def meeting_stop_presenting(sid, data):
    """Release the presenter slot - allowed for the current presenter
    themselves, or the meeting organizer as a moderation override."""
    stream_id = data.get('stream_id')
    if not stream_id:
        return
    if sid not in manager.active_connections:
        return
    user_id = manager.active_connections[sid]['user_id']

    current = manager.meeting_presenters.get(stream_id)
    if not current:
        return
    is_current_presenter = current['user_id'] == user_id
    is_organizer = False
    if not is_current_presenter:
        organizer_id, _ = await _require_organizer_sid(sid, stream_id)
        is_organizer = organizer_id is not None
    if not is_current_presenter and not is_organizer:
        return

    del manager.meeting_presenters[stream_id]
    await sio.emit(
        'meeting:presenter_changed',
        {'stream_id': stream_id, 'presenter_user_id': None, 'presenter_username': None, 'presenter_sid': None},
        room=_stream_room(stream_id),
    )

@sio.on('stream:chat_message')
async def stream_chat_message(sid, data):
    """Live chat message (or reply, when parent_comment_id is set) for a
    stream - persisted, then broadcast to host + all viewers."""
    if sid not in manager.active_connections:
        return
    user_id = manager.active_connections[sid]['user_id']
    if await _reject_if_restricted(sid, user_id, event='stream:error'):
        return
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
    if await _reject_if_restricted(sid, user_id, event='stream:error'):
        return
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
