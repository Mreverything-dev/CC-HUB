// frontend/src/features/dashboard/hooks/useAdminUsers.ts
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  adminService,
  AdminUserListParams,
  AdminUserRole,
  AdminUpdateUserRequest,
  AdminSetPasswordRequest,
} from '@/services/api/admin.service';

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

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AdminUserRole }) =>
      adminService.updateUserRole(userId, role),
    onSuccess: (response) => {
      toast.success(`${response.data.username} is now ${response.data.role}`);
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminUserDetail', response.data.id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to change role');
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: AdminUpdateUserRequest }) =>
      adminService.updateUser(userId, data),
    onSuccess: (response) => {
      toast.success(`${response.data.username} updated`);
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminUserDetail', response.data.id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update user');
    },
  });

  const setPassword = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: AdminSetPasswordRequest }) =>
      adminService.setUserPassword(userId, data),
    onSuccess: (response) => {
      toast.success(response.data.message);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update password');
    },
  });

  const deleteUser = useMutation({
    mutationFn: (userId: string) => adminService.deleteUser(userId),
    onSuccess: (response) => {
      toast.success(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
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
    updateRole: updateRole.mutateAsync,
    isUpdatingRole: updateRole.isPending,
    updateUser: updateUser.mutateAsync,
    isUpdatingUser: updateUser.isPending,
    setPassword: setPassword.mutateAsync,
    isSettingPassword: setPassword.isPending,
    deleteUser: deleteUser.mutateAsync,
    isDeletingUser: deleteUser.isPending,
  };
}

/** Single-user fresh fetch, for the User Management page's "View Details"
 * action - only enabled while a user id is actually selected. */
export function useAdminUserDetail(userId: string | null) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['adminUserDetail', userId],
    queryFn: async () => (await adminService.getUser(userId as string)).data,
    enabled: !!userId,
  });
  return { data, isLoading, isError, refetch };
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
