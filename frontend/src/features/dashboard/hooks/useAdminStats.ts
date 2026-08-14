// frontend/src/features/dashboard/hooks/useAdminStats.ts
import { useQuery } from '@tanstack/react-query';
import { adminService, UserGrowthRange } from '@/services/api/admin.service';

export function useAdminStats() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['adminDashboardStats'],
    queryFn: async () => (await adminService.getDashboardStats()).data,
  });

  return { stats: data, isLoading, isError, refetch, isFetching };
}

export function useUserGrowth(range: UserGrowthRange) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['adminUserGrowth', range],
    queryFn: async () => (await adminService.getUserGrowth(range)).data,
  });

  return { growth: data, isLoading, isError, refetch };
}
