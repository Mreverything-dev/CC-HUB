// frontend/src/features/dashboard/hooks/useProfessorCodes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminService, ProfessorCodeValidity } from '@/services/api/admin.service';

export function useProfessorCodes() {
  const queryClient = useQueryClient();

  const { data: codes = [], isLoading, refetch } = useQuery({
    queryKey: ['professorCodes'],
    queryFn: async () => (await adminService.getProfessorCodes()).data,
  });

  const generateCode = useMutation({
    mutationFn: (validity: ProfessorCodeValidity) => adminService.generateProfessorCode(validity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professorCodes'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to generate professor code');
    },
  });

  const deleteCode = useMutation({
    mutationFn: (code: string) => adminService.deleteProfessorCode(code),
    onSuccess: () => {
      toast.success('Professor code deleted');
      queryClient.invalidateQueries({ queryKey: ['professorCodes'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete professor code');
    },
  });

  return {
    codes,
    isLoading,
    refetch,
    generateCode: generateCode.mutateAsync,
    isGenerating: generateCode.isPending,
    deleteCode: deleteCode.mutateAsync,
  };
}
