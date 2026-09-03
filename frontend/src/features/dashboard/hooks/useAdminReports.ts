// frontend/src/features/dashboard/hooks/useAdminReports.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminService, type AdminRestrictionDuration } from '@/services/api/admin.service';

export function useAdminReports(params: { page?: number; limit?: number; category?: string; status?: string; search?: string }) {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['adminReports', params],
    queryFn: async () => (await adminService.getReports(params)).data,
  });

  return { data, isLoading, isError, isFetching, refetch };
}

export function useAdminReportActions() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['adminReports'] });

  const dismiss = useMutation({
    mutationFn: (reportId: string) => adminService.dismissReport(reportId),
    onSuccess: invalidate,
  });
  const validate = useMutation({
    mutationFn: (reportId: string) => adminService.validateReport(reportId),
    onSuccess: invalidate,
  });
  const warn = useMutation({
    mutationFn: (reportId: string) => adminService.warnReportedUser(reportId),
    onSuccess: invalidate,
  });
  const restrict = useMutation({
    mutationFn: ({ reportId, duration }: { reportId: string; duration: AdminRestrictionDuration }) =>
      adminService.restrictReportedUser(reportId, duration),
    onSuccess: invalidate,
  });
  const removePost = useMutation({
    mutationFn: (reportId: string) => adminService.removeReportedPost(reportId),
    onSuccess: invalidate,
  });

  return { dismiss, validate, warn, restrict, removePost };
}
