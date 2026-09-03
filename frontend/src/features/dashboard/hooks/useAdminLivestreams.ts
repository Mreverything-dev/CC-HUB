// frontend/src/features/dashboard/hooks/useAdminLivestreams.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminService, AdminLivestreamContext, AdminLivestreamStatusFilter } from '@/services/api/admin.service';

export function useAdminLivestreams(context: AdminLivestreamContext, status?: AdminLivestreamStatusFilter) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['adminLivestreams', context, status],
    queryFn: async () => (await adminService.getLivestreams({ context, status })).data,
    // Active sessions can end/change on their own - keep this reasonably fresh
    // without a full websocket subscription for what's an occasional-use admin page.
    refetchInterval: status === 'ended' ? false : 15000,
  });

  const endStream = useMutation({
    mutationFn: (streamId: string) => adminService.endLivestream(streamId),
    onSuccess: () => {
      toast.success('Session ended');
      queryClient.invalidateQueries({ queryKey: ['adminLivestreams'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to end session');
    },
  });

  return {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
    endStream: endStream.mutateAsync,
    isEnding: endStream.isPending,
  };
}

export function useAdminStreamViewers(streamId: string | null) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['adminStreamViewers', streamId],
    queryFn: async () => (await adminService.getLivestreamViewers(streamId as string)).data,
    enabled: !!streamId,
  });
  return { data: data || [], isLoading, refetch };
}
