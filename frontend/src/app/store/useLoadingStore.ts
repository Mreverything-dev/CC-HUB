// frontend/src/app/store/useLoadingStore.ts
import { create } from 'zustand';

interface LoadingState {
  isLoading: boolean;
  message: string;
  show: (message?: string) => void;
  hide: () => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  isLoading: false,
  message: 'Loading...',
  show: (message = 'Loading...') => set({ isLoading: true, message }),
  hide: () => set({ isLoading: false }),
}));