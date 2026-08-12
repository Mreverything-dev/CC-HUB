// frontend/src/features/announcements/hooks/useAnnouncements.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementApi } from '@/services/api/announcement.service';
import { useAnnouncementStore } from '../store/announcement.store';
import { AnnouncementCreate, AnnouncementUpdate } from '@/types/announcement.types';
import toast from 'react-hot-toast';

export function useAnnouncements() {
  const queryClient = useQueryClient();
  const { setAnnouncements, addAnnouncement, updateAnnouncement, removeAnnouncement } = useAnnouncementStore();

  // Get all announcements
  const { data: announcements = [], isLoading, error, refetch } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      try {
        console.log('📢 Fetching announcements...');
        const response = await announcementApi.getAnnouncements();
        console.log('📢 Raw API response:', response);
        
        // Handle different response structures
        let items = [];
        if (response.data && response.data.items) {
          items = response.data.items;
        } else if (Array.isArray(response.data)) {
          items = response.data;
        } else {
          items = response.data || [];
        }
        
        console.log('📢 Processed announcements:', items);
        setAnnouncements(items);
        return items;
      } catch (err) {
        console.error('❌ Error fetching announcements:', err);
        return [];
      }
    },
    // ✅ Fix caching settings
    staleTime: 0, // Always refetch when component mounts
    gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes (formerly cacheTime)
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Refetch on reconnect
    retry: 2, // Retry twice on failure
    retryDelay: 1000, // Wait 1 second between retries
    initialData: [], // Always start with empty array
  });

  // Create announcement
  const createAnnouncement = useMutation({
    mutationFn: async (data: AnnouncementCreate) => {
      console.log('📝 Creating announcement:', data);
      const response = await announcementApi.createAnnouncement(data);
      console.log('✅ Announcement created:', response.data);
      return response;
    },
    onSuccess: (response) => {
      addAnnouncement(response.data);
      toast.success('Announcement created successfully!');
      // ✅ Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      // ✅ Force refetch
      setTimeout(() => {
        refetch();
      }, 500);
    },
    onError: (error: any) => {
      console.error('❌ Create announcement error:', error);
      toast.error(error.response?.data?.detail || 'Failed to create announcement');
    },
  });

  // Update announcement
  const updateAnnouncementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AnnouncementUpdate }) => {
      console.log('📝 Updating announcement:', id, data);
      const response = await announcementApi.updateAnnouncement(id, data);
      console.log('✅ Announcement updated:', response.data);
      return response;
    },
    onSuccess: (response) => {
      updateAnnouncement(response.data.id, response.data);
      toast.success('Announcement updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setTimeout(() => {
        refetch();
      }, 500);
    },
    onError: (error: any) => {
      console.error('❌ Update announcement error:', error);
      toast.error(error.response?.data?.detail || 'Failed to update announcement');
    },
  });

  // Delete announcement
  const deleteAnnouncement = useMutation({
    mutationFn: async (id: string) => {
      console.log('🗑️ Deleting announcement:', id);
      await announcementApi.deleteAnnouncement(id);
      return id;
    },
    onSuccess: (id) => {
      removeAnnouncement(id);
      toast.success('Announcement deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setTimeout(() => {
        refetch();
      }, 500);
    },
    onError: (error: any) => {
      console.error('❌ Delete announcement error:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete announcement');
    },
  });

  // Toggle publish
  const togglePublish = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      console.log('🔄 Toggling publish status:', id, isPublished);
      const response = await announcementApi.togglePublish(id, isPublished);
      console.log('✅ Toggle publish response:', response.data);
      return response;
    },
    onSuccess: (response) => {
      updateAnnouncement(response.data.id, { is_published: response.data.is_published });
      toast.success(`Announcement ${response.data.is_published ? 'published' : 'unpublished'}`);
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setTimeout(() => {
        refetch();
      }, 500);
    },
    onError: (error: any) => {
      console.error('❌ Toggle publish error:', error);
      toast.error(error.response?.data?.detail || 'Failed to toggle publish status');
    },
  });

  // React to an announcement (add/change/remove)
  const reactToAnnouncement = useMutation({
    mutationFn: async ({ id, reaction }: { id: string; reaction: string }) => {
      const response = await announcementApi.reactToAnnouncement(id, reaction);
      return response.data;
    },
    onSuccess: (data) => {
      updateAnnouncement(data.announcement_id, { reactions: data.reactions });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to react to announcement');
    },
  });

  // Save/unsave an announcement
  const toggleBookmark = useMutation({
    mutationFn: async (id: string) => {
      const response = await announcementApi.toggleBookmark(id);
      return response.data;
    },
    onSuccess: (data) => {
      updateAnnouncement(data.announcement_id, { is_bookmarked: data.is_bookmarked });
      toast.success(data.is_bookmarked ? 'Saved announcement' : 'Removed from saved');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update saved announcements');
    },
  });

  return {
    announcements: announcements || [],
    isLoading,
    error,
    createAnnouncement: createAnnouncement.mutateAsync,
    updateAnnouncement: updateAnnouncementMutation.mutateAsync,
    deleteAnnouncement: deleteAnnouncement.mutateAsync,
    togglePublish: togglePublish.mutateAsync,
    reactToAnnouncement: reactToAnnouncement.mutateAsync,
    toggleBookmark: toggleBookmark.mutateAsync,
    isCreating: createAnnouncement.isPending,
    isUpdating: updateAnnouncementMutation.isPending,
    isDeleting: deleteAnnouncement.isPending,
    refetch, // ✅ Expose refetch function
  };
}