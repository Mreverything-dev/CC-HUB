// frontend/src/features/livestream/store/liveSession.store.ts
import { create } from 'zustand';

interface LiveSessionState {
  /** The stream currently being viewed/hosted, or null if none. */
  streamId: string | null;
  /** Whether the current user is hosting this stream. */
  isHost: boolean;
  /** Whether the stage is minimized (PiP-style floating player). */
  isMinimized: boolean;

  startSession: (streamId: string, isHost: boolean) => void;
  endSession: () => void;
  minimize: () => void;
  restore: () => void;
}

export const useLiveSessionStore = create<LiveSessionState>((set) => ({
  streamId: null,
  isHost: false,
  isMinimized: false,

  startSession: (streamId, isHost) =>
    set({ streamId, isHost, isMinimized: false }),

  endSession: () =>
    set({ streamId: null, isHost: false, isMinimized: false }),

  minimize: () => set({ isMinimized: true }),

  restore: () => set({ isMinimized: false }),
}));