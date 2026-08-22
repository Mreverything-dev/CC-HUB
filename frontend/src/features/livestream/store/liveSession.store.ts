// frontend/src/features/livestream/store/liveSession.store.ts
import { create } from 'zustand';

interface LiveSessionState {
  /** The one livestream currently being watched/hosted app-wide, or null.
   * Mirrors chat.store.ts's isWidgetOpen pattern - driven from here so the
   * player (mounted globally, outside the router) survives navigation
   * instead of tearing down its WebRTC connection on every route change. */
  streamId: string | null;
  isHost: boolean;
  isMinimized: boolean;
  startSession: (streamId: string, isHost: boolean) => void;
  minimize: () => void;
  restore: () => void;
  endSession: () => void;
}

export const useLiveSessionStore = create<LiveSessionState>((set) => ({
  streamId: null,
  isHost: false,
  isMinimized: false,

  // Always starts expanded, even if a previous session had been minimized -
  // switching to a different stream (or reopening the same one) should
  // never silently stay hidden as a mini player.
  startSession: (streamId, isHost) => set({ streamId, isHost, isMinimized: false }),

  minimize: () => set({ isMinimized: true }),
  restore: () => set({ isMinimized: false }),
  endSession: () => set({ streamId: null, isHost: false, isMinimized: false }),
}));
