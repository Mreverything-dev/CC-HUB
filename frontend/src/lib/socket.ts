import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/features/auth/store/auth.store';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    const token = useAuthStore.getState().token;
    const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }

  emit(event: string, data: any) {
    if (this.socket) {
      this.socket.emit(event, data);
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
}

export const socketService = new SocketService();
