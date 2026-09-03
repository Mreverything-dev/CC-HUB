// frontend/src/features/dashboard/hooks/useAdminAnnouncements.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminService } from '@/services/api/admin.service';
import { announcementApi } from '@/services/api/announcement.service';

/** Admin-wide announcement listing (including other users' unpublished
 * drafts) is the only new read path here - create/update/delete all reuse
 * the existing, already role-audited /announcements endpoints via
 * announcementApi, exactly like a normal professor/officer would call them. */
export function useAdminAnnouncements(params: { page?: number; limit?: number; search?: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['adminAnnouncements', params],
    queryFn: async () => (await adminService.getAnnouncements(params)).data,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['adminAnnouncements'] });
    queryClient.invalidateQueries({ queryKey: ['announcements'] });
  };

  const deleteAnnouncement = useMutation({
    mutationFn: (id: string) => announcementApi.deleteAnnouncement(id),
    onSuccess: () => {
      toast.success('Announcement deleted');
      invalidate();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete announcement');
    },
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      announcementApi.togglePublish(id, isPublished),
    onSuccess: (response) => {
      toast.success(response.data.is_published ? 'Announcement published' : 'Announcement unpublished');
      invalidate();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update announcement');
    },
  });

  return {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
    deleteAnnouncement: deleteAnnouncement.mutateAsync,
    isDeleting: deleteAnnouncement.isPending,
    togglePublish: togglePublish.mutateAsync,
  };
}
