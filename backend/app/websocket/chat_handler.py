# backend/app/websocket/chat_handler.py
from app.websocket.manager import sio, manager
import json

@sio.event
async def send_message(sid, data):
    """Handle sending a message"""
    user_id = manager.active_connections.get(sid, {}).get('user_id')
    if not user_id:
        return
    
    conversation_id = data.get('conversation_id')
    content = data.get('content')
    message_type = data.get('type', 'text')
    
    # Save message to database
    # Broadcast to conversation room
    await sio.emit('new_message', {
        'conversation_id': conversation_id,
        'sender_id': user_id,
        'content': content,
        'type': message_type,
        'timestamp': datetime.utcnow().isoformat()
    }, room=f"conversation_{conversation_id}")

@sio.event
async def typing(sid, data):
    """Handle typing indicator"""
    user_id = manager.active_connections.get(sid, {}).get('user_id')
    conversation_id = data.get('conversation_id')
    is_typing = data.get('is_typing', False)
    
    await sio.emit('user_typing', {
        'user_id': user_id,
        'conversation_id': conversation_id,
        'is_typing': is_typing
    }, room=f"conversation_{conversation_id}")