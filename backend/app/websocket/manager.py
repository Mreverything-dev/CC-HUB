import socketio
from typing import Dict, List, Any

sio = socketio.AsyncServer(
    cors_allowed_origins='*',
    async_mode='asgi',
    logger=True
)

class SocketManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, Any]] = {}
        self.rooms: Dict[str, List[str]] = {}

    async def connect(self, sid: str, user_id: str):
        self.active_connections[sid] = {'user_id': user_id}
        await sio.emit('connection_established', {'status': 'connected'}, room=sid)

    async def disconnect(self, sid: str):
        if sid in self.active_connections:
            del self.active_connections[sid]

    async def join_room(self, sid: str, room: str):
        if room not in self.rooms:
            self.rooms[room] = []
        if sid not in self.rooms[room]:
            self.rooms[room].append(sid)
            await sio.enter_room(sid, room)

manager = SocketManager()

@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")
    await sio.emit('connected', {'sid': sid}, room=sid)

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")
    await manager.disconnect(sid)
