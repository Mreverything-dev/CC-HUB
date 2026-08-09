// frontend/src/features/announcements/store/announcement.store.ts
import { create } from 'zustand';
import { Announcement } from '@/types/announcement.types';

interface AnnouncementStore {
  announcements: Announcement[];
  isLoading: boolean;
  error: string | null;
  setAnnouncements: (announcements: Announcement[]) => void;
  addAnnouncement: (announcement: Announcement) => void;
  updateAnnouncement: (id: string, data: Partial<Announcement>) => void;
  removeAnnouncement: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAnnouncementStore = create<AnnouncementStore>((set) => ({
  announcements: [],
  isLoading: false,
  error: null,
  
  setAnnouncements: (announcements) => set({ announcements }),
  
  addAnnouncement: (announcement) => set((state) => ({
    announcements: [announcement, ...state.announcements]
  })),
  
  updateAnnouncement: (id, data) => set((state) => ({
    announcements: state.announcements.map((a) =>
      a.id === id ? { ...a, ...data } : a
    )
  })),
  
  removeAnnouncement: (id) => set((state) => ({
    announcements: state.announcements.filter((a) => a.id !== id)
  })),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),
}));