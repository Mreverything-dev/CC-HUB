// frontend/src/features/sections/hooks/useTeachingAssignments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teachingAssignmentApi } from '@/services/api/teaching_assignment.service';
import { TeachingAssignmentCreate, TeachingAssignmentUpdate } from '@/types/section.types';
import toast from 'react-hot-toast';

export function useTeachingAssignments() {
  const queryClient = useQueryClient();

  // The current professor's assignments across all sections
  const { data: mine = [], isLoading, refetch } = useQuery({
    queryKey: ['teaching-assignments', 'mine'],
    queryFn: async () => {
      const response = await teachingAssignmentApi.getMine();
      return response.data;
    },
    staleTime: 0,
  });

  const getForSection = async (sectionId: string) => {
    const response = await teachingAssignmentApi.getForSection(sectionId);
    return response.data;
  };

  const joinSection = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: TeachingAssignmentCreate }) =>
      teachingAssignmentApi.joinSection(sectionId, data),
    onSuccess: () => {
      toast.success('You joined the section!');
      queryClient.invalidateQueries({ queryKey: ['teaching-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to join section');
    },
  });

  const updateAssignment = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TeachingAssignmentUpdate }) =>
      teachingAssignmentApi.update(id, data),
    onSuccess: () => {
      toast.success('Teaching assignment updated!');
      queryClient.invalidateQueries({ queryKey: ['teaching-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update teaching assignment');
    },
  });

  const removeAssignment = useMutation({
    mutationFn: (id: string) => teachingAssignmentApi.remove(id),
    onSuccess: () => {
      toast.success('Teaching assignment removed');
      queryClient.invalidateQueries({ queryKey: ['teaching-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to remove teaching assignment');
    },
  });

  return {
    mine,
    isLoading,
    refetch,
    getForSection,
    joinSection: joinSection.mutateAsync,
    updateAssignment: updateAssignment.mutateAsync,
    removeAssignment: removeAssignment.mutateAsync,
  };
}
