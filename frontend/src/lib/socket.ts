// frontend/src/lib/socket.ts
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '@/features/chat/store/chat.store';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { authApi } from '@/features/auth/api/auth.api';
import { Message } from '@/types/chat.types';
import toast from 'react-hot-toast';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  // Guards around the "access token expired mid-connection" recovery path
  // (see handleAuthFailureAndReconnect below) - prevents overlapping refresh
  // calls and caps retries so a broken/expired refresh token can never cause
  // an infinite connect/disconnect loop.
  private isRefreshingAuth = false;
  private authRetryCount = 0;
  private readonly maxAuthRetries = 3;

  connect() {
    const token = useAuthStore.getState().token || localStorage.getItem('token');
    // Same host-derived fallback as lib/axios.ts, so chat/live WebSocket
    // connections also work automatically over LAN, not just the REST API.
    const WS_URL = import.meta.env.VITE_WS_URL || `http://${window.location.hostname}:8000`;

    if (!token) {
      console.error('❌ No token found for WebSocket connection');
      return;
    }

    // ✅ If socket exists, disconnect first
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // ✅ Connect with proper configuration
    this.socket = io(WS_URL, {
      path: '/ws/socket.io',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: {
        token
      },
      query: {
        token
      },
      extraHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    this.setupListeners();
    return this.socket;
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected successfully');
      useChatStore.getState().setConnected(true);
      this.reconnectAttempts = 0;
      this.authRetryCount = 0;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      useChatStore.getState().setConnected(false);
      this.reconnectAttempts++;

      // Network/handshake-level failures are retried automatically by
      // socket.io's own `reconnection` option using the same token - that's
      // fine here since this event does NOT fire for token/auth rejections
      // (the backend accepts the connection first, then disconnects it after
      // rejecting the token - see the 'disconnect' handler below).
      if (this.reconnectAttempts > this.maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached');
        toast.error('Unable to connect to chat server');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`❌ Socket disconnected: ${reason}`);
      useChatStore.getState().setConnected(false);

      if (reason === 'io server disconnect') {
        // The server forcibly closed the connection. In this app that only
        // happens when the access token failed authentication (expired or
        // invalid) - socket.io does NOT auto-reconnect after this reason, and
        // simply reconnecting would just resend the same expired token and
        // loop forever. Refresh the access token first, then reconnect.
        this.handleAuthFailureAndReconnect();
      }
    });

    this.socket.on('connected', (data) => {
      console.log('🔗 Connected with user:', data);
    });

    this.socket.on('new_message', (message: Message) => {
      console.log('📩 New message received:', message);
      const { currentConversation, addMessage, incrementUnreadCount } = useChatStore.getState();

      addMessage(message);
      useChatStore.getState().updateConversation(message.conversation_id, {
        last_message: message,
        updated_at: message.created_at
      });

      if (currentConversation?.id !== message.conversation_id) {
        incrementUnreadCount();
        toast.success(`New message from ${message.sender_username}`);
      }
    });

    this.socket.on('message:reaction', (data: { message_id: string; reactions: { user_id: string; reaction: string }[] }) => {
      useChatStore.getState().updateMessage(data.message_id, { reactions: data.reactions });
    });

    this.socket.on('user_typing', (data: { user_id: string; conversation_id: string; is_typing: boolean }) => {
      const { user_id, conversation_id, is_typing } = data;
      useChatStore.getState().setUserTyping(conversation_id, user_id, is_typing);

      // Safety auto-clear: if a "stopped typing" event is lost (e.g. tab closed
      // mid-keystroke), don't leave the indicator stuck on forever.
      const key = `${conversation_id}:${user_id}`;
      const existing = this.typingTimeouts.get(key);
      if (existing) clearTimeout(existing);

      if (is_typing) {
        const timeout = setTimeout(() => {
          useChatStore.getState().setUserTyping(conversation_id, user_id, false);
          this.typingTimeouts.delete(key);
        }, 3000);
        this.typingTimeouts.set(key, timeout);
      } else {
        this.typingTimeouts.delete(key);
      }
    });

    this.socket.on('messages_read', (data) => {
      console.log('📖 Messages read:', data);
    });

    this.socket.on('new_message_notification', (data) => {
      console.log('🔔 New message notification:', data);
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      if (error.message === 'Invalid token' || error.message === 'Authentication required') {
        // The actual recovery (refresh + reconnect, or give up) happens in the
        // 'disconnect' handler above once the server closes the connection.
        useChatStore.getState().setConnected(false);
      }
    });
  }

  /**
   * Called when the server closes the socket because the access token it was
   * connecting with failed authentication. Refreshes the access token via the
   * same REST refresh-token flow the Axios client uses, then reconnects with
   * the NEW token. Never retries with the token that just failed, and gives
   * up (clearing auth + sending the user to login) if the refresh token
   * itself is invalid/expired or the retry budget is exhausted.
   */
  private async handleAuthFailureAndReconnect() {
    if (this.isRefreshingAuth) return;

    if (this.authRetryCount >= this.maxAuthRetries) {
      console.error('❌ Max auth-refresh retries reached, giving up.');
      this.giveUpAndLogout();
      return;
    }

    this.authRetryCount++;
    this.isRefreshingAuth = true;

    try {
      const refreshToken = useAuthStore.getState().refreshToken || localStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      console.log('🔄 Socket auth failed, refreshing access token...');
      const response = await authApi.refreshToken(refreshToken);
      const newToken = response.data.access_token;

      const user = useAuthStore.getState().user;
      if (user) {
        useAuthStore.getState().login(user, newToken, refreshToken);
      } else {
        localStorage.setItem('token', newToken);
        useAuthStore.getState().setToken(newToken);
      }

      console.log('✅ Access token refreshed, reconnecting socket...');
      this.connect();
    } catch (err) {
      console.error('❌ Socket auth refresh failed, stopping reconnection:', err);
      this.giveUpAndLogout();
    } finally {
      this.isRefreshingAuth = false;
    }
  }

  private giveUpAndLogout() {
    this.disconnect();
    useAuthStore.getState().logout();
    toast.error('Session expired. Please log in again.');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      useChatStore.getState().setConnected(false);
      console.log('🔌 Socket disconnected manually');
    }
    this.isRefreshingAuth = false;
    this.authRetryCount = 0;
  }

  reconnect() {
    console.log('🔄 Manual reconnection attempt');
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    } else {
      this.connect();
    }
  }

  getSocket() {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  emit(event: string, data: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
      console.log(`📤 Emitted ${event}:`, data);
    } else {
      console.warn(`⚠️ Socket not connected for ${event}, reconnecting...`);
      if (this.socket) {
        this.socket.connect();
        // Queue the emit after connection
        setTimeout(() => {
          if (this.socket?.connected) {
            this.socket.emit(event, data);
          }
        }, 1000);
      }
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string) {
    if (this.socket) {
      this.socket.off(event);
    }
  }

  // Chat specific methods
  joinConversation(conversationId: string) {
    this.emit('join_room', { room: `conversation_${conversationId}` });
  }

  leaveConversation(conversationId: string) {
    this.emit('leave_room', { room: `conversation_${conversationId}` });
  }

  sendMessage(conversationId: string, content: string, type: string = 'text', mediaUrl?: string, mediaName?: string) {
    this.emit('send_message', {
      conversation_id: conversationId,
      content,
      type,
      media_url: mediaUrl,
      media_name: mediaName
    });
  }

  sendTyping(conversationId: string, isTyping: boolean) {
    this.emit('typing', {
      conversation_id: conversationId,
      is_typing: isTyping
    });
  }

  markRead(conversationId: string) {
    this.emit('mark_read', { conversation_id: conversationId });
  }

  reactToMessage(messageId: string, reaction: string) {
    this.emit('message:react', { message_id: messageId, reaction });
  }

  // Livestream signaling - the server only relays these between the host and
  // viewer sids involved; permission checks happen server-side.
  announceStreamHost(streamId: string) {
    this.emit('stream:host_start', { stream_id: streamId });
  }

  joinStreamAsViewer(streamId: string) {
    this.emit('stream:viewer_join', { stream_id: streamId });
  }

  leaveStream(streamId: string) {
    this.emit('stream:leave', { stream_id: streamId });
  }

  sendStreamOffer(streamId: string, targetSid: string, sdp: RTCSessionDescriptionInit) {
    this.emit('stream:offer', { stream_id: streamId, target_sid: targetSid, sdp });
  }

  sendStreamAnswer(streamId: string, sdp: RTCSessionDescriptionInit) {
    this.emit('stream:answer', { stream_id: streamId, sdp });
  }

  sendStreamIceCandidate(streamId: string, targetSid: string, candidate: RTCIceCandidateInit) {
    this.emit('stream:ice_candidate', { stream_id: streamId, target_sid: targetSid, candidate });
  }

  sendStreamChatMessage(streamId: string, message: string, parentCommentId?: string | null) {
    this.emit('stream:chat_message', {
      stream_id: streamId,
      message,
      ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
    });
  }

  sendStreamCommentReaction(streamId: string, commentId: string, reaction: string) {
    this.emit('stream:comment_react', { stream_id: streamId, comment_id: commentId, reaction });
  }

  deleteStreamComment(streamId: string, commentId: string) {
    this.emit('stream:comment_delete', { stream_id: streamId, comment_id: commentId });
  }
}

export const socketService = new SocketService();

// ✅ Helper to check connection status
export const isSocketConnected = () => socketService.isConnected();