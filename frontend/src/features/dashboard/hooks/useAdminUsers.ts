// frontend/src/features/dashboard/hooks/useAdminUsers.ts
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminService, AdminUserListParams } from '@/services/api/admin.service';

export function useAdminUsers(params: AdminUserListParams) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['adminUsers', params],
    queryFn: async () => (await adminService.getUsers(params)).data,
  });

  const updateStatus = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminService.updateUserStatus(userId, isActive),
    onSuccess: (response) => {
      toast.success(response.data.is_active ? `${response.data.username} activated` : `${response.data.username} suspended`);
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update user status');
    },
  });

  return {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
    updateStatus: updateStatus.mutateAsync,
    isUpdatingStatus: updateStatus.isPending,
  };
}

/** Small helper for the search box's debounced value, kept local to this
 * feature rather than pulling in a new dependency for one input. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);
  return debounced;
}
