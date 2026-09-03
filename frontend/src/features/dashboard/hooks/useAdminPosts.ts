// frontend/src/features/dashboard/hooks/useAdminPosts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminService } from '@/services/api/admin.service';
import { api } from '@/lib/axios';

export function useAdminPosts(params: { page?: number; limit?: number; search?: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['adminPosts', params],
    queryFn: async () => (await adminService.getPosts(params)).data,
  });

  // Reuses the existing, already-admin-capable DELETE /posts/{id} endpoint
  // (PostService.delete_post already bypasses ownership for role == "admin")
  // rather than adding a second delete path.
  const deletePost = useMutation({
    mutationFn: (postId: string) => api.delete(`/posts/${postId}`),
    onSuccess: () => {
      toast.success('Post removed');
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to remove post');
    },
  });

  // Admin-only bulk removal - reuses the same single-post deletion logic
  // per id server-side (see PostService.bulk_delete_posts), just batched
  // behind one request instead of N.
  const bulkDeletePosts = useMutation({
    mutationFn: (postIds: string[]) => adminService.bulkDeletePosts(postIds),
    onSuccess: (res) => {
      const { deleted_count, not_found_ids } = res.data;
      if (not_found_ids.length > 0) {
        toast.success(`${deleted_count} post${deleted_count === 1 ? '' : 's'} removed (${not_found_ids.length} already gone)`);
      } else {
        toast.success(`${deleted_count} post${deleted_count === 1 ? '' : 's'} removed`);
      }
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to remove selected posts');
    },
  });

  return {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
    deletePost: deletePost.mutateAsync,
    isDeleting: deletePost.isPending,
    bulkDeletePosts: bulkDeletePosts.mutateAsync,
    isBulkDeleting: bulkDeletePosts.isPending,
  };
}
