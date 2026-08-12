// frontend/src/services/api/announcement.service.ts
import { api } from '@/lib/axios';
import { Announcement, AnnouncementCreate, AnnouncementUpdate } from '@/types/announcement.types';

export const announcementApi = {
  // Get all announcements
  getAnnouncements: () => {
    console.log('📡 API Call: GET /announcements/');
    return api.get('/announcements/');
  },
  
  // Get single announcement
  getAnnouncement: (id: string) => {
    console.log(`📡 API Call: GET /announcements/${id}`);
    return api.get<Announcement>(`/announcements/${id}`);
  },
  
  // Create announcement
  createAnnouncement: (data: AnnouncementCreate) => {
    console.log('📡 API Call: POST /announcements/', data);
    return api.post<Announcement>('/announcements/', data);
  },
  
  // Update announcement
  updateAnnouncement: (id: string, data: AnnouncementUpdate) => {
    console.log(`📡 API Call: PUT /announcements/${id}`, data);
    return api.put<Announcement>(`/announcements/${id}`, data);
  },
  
  // Delete announcement
  deleteAnnouncement: (id: string) => {
    console.log(`📡 API Call: DELETE /announcements/${id}`);
    return api.delete(`/announcements/${id}`);
  },
  
  // Toggle publish status
  togglePublish: (id: string, isPublished: boolean) => {
    console.log(`📡 API Call: PATCH /announcements/${id}/publish`, { is_published: isPublished });
    return api.patch(`/announcements/${id}/publish`, { is_published: isPublished });
  },

  // Add/change/remove the current user's reaction
  reactToAnnouncement: (id: string, reaction: string) => {
    return api.post<{ announcement_id: string; user_id: string; reaction: string | null; reactions: { user_id: string; reaction: string }[] }>(
      `/announcements/${id}/react`,
      { reaction }
    );
  },

  // Save/unsave (toggle)
  toggleBookmark: (id: string) => {
    return api.post<{ announcement_id: string; is_bookmarked: boolean }>(`/announcements/${id}/bookmark`);
  },
};