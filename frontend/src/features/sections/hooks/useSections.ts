// frontend/src/features/sections/hooks/useSections.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sectionApi } from '@/services/api/section.service';
import { useSectionStore } from '../store/section.store';
import { SectionCreate, SectionUpdate } from '@/types/section.types';
import toast from 'react-hot-toast';

export function useSections() {
  const queryClient = useQueryClient();
  const {
    sections,
    currentSection,
    setSections,
    setCurrentSection,
    addSection,
    updateSection,
    removeSection,
    removeMember,
  } = useSectionStore();

  // Get all sections
  const { isLoading, refetch } = useQuery({
    queryKey: ['sections'],
    queryFn: async () => {
      const response = await sectionApi.getSections();
      setSections(response.data);
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Get single section
  const getSection = async (id: string) => {
    const response = await sectionApi.getSection(id);
    setCurrentSection(response.data);
    return response.data;
  };

  // Platform-wide section discovery for the Join Existing Section flow and
  // the Create Section duplicate-name check - not scoped to "my sections".
  const browseSections = async (params: { year_level?: number; name?: string }) => {
    const response = await sectionApi.browseSections(params);
    return response.data;
  };

  // Create section
  const createSection = useMutation({
    mutationFn: (data: SectionCreate) => sectionApi.createSection(data),
    onSuccess: (response) => {
      addSection(response.data);
      toast.success('Section created successfully!');
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create section');
    },
  });

  // Update section
  const updateSectionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SectionUpdate }) =>
      sectionApi.updateSection(id, data),
    onSuccess: (response) => {
      updateSection(response.data.id, response.data);
      toast.success('Section updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update section');
    },
  });

  // Delete section
  const deleteSection = useMutation({
    mutationFn: (id: string) => sectionApi.deleteSection(id),
    onSuccess: (_, id) => {
      removeSection(id);
      toast.success('Section deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete section');
    },
  });

  // Add member
  const addMember = useMutation({
    mutationFn: ({ sectionId, userId }: { sectionId: string; userId: string }) =>
      sectionApi.addMember(sectionId, userId),
    onSuccess: (_response, { sectionId }) => {
      toast.success('Student added to section!');
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      // Refresh section data
      getSection(sectionId);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to add student');
    },
  });

  // Remove member
  const removeMemberMutation = useMutation({
    mutationFn: ({ sectionId, userId }: { sectionId: string; userId: string }) =>
      sectionApi.removeMember(sectionId, userId),
    onSuccess: (_, { sectionId, userId }) => {
      removeMember(sectionId, userId);
      toast.success('Student removed from section!');
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to remove student');
    },
  });

  // Promote to officer
  const promoteToOfficer = useMutation({
    mutationFn: ({ sectionId, userId }: { sectionId: string; userId: string }) =>
      sectionApi.promoteToOfficer(sectionId, userId),
    onSuccess: (_, { sectionId }) => {
      toast.success('Student promoted to Officer!');
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      getSection(sectionId);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to promote');
    },
  });

  // Demote officer
  const demoteOfficer = useMutation({
    mutationFn: ({ sectionId, userId }: { sectionId: string; userId: string }) =>
      sectionApi.demoteOfficer(sectionId, userId),
    onSuccess: (_, { sectionId }) => {
      toast.success('Officer demoted to Student!');
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      getSection(sectionId);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to demote');
    },
  });

  // Promote to mayor
  const promoteToMayor = useMutation({
    mutationFn: ({ sectionId, userId }: { sectionId: string; userId: string }) =>
      sectionApi.promoteToMayor(sectionId, userId),
    onSuccess: (_, { sectionId }) => {
      toast.success('Student promoted to Class Mayor!');
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      getSection(sectionId);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to promote');
    },
  });

  // Demote mayor
  const demoteMayor = useMutation({
    mutationFn: ({ sectionId, userId }: { sectionId: string; userId: string }) =>
      sectionApi.demoteMayor(sectionId, userId),
    onSuccess: (_, { sectionId }) => {
      toast.success('Mayor demoted to Student!');
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      getSection(sectionId);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to demote');
    },
  });

  return {
    sections,
    currentSection,
    isLoading,
    refetch,
    getSection,
    browseSections,
    createSection: createSection.mutateAsync,
    updateSection: updateSectionMutation.mutateAsync,
    deleteSection: deleteSection.mutateAsync,
    addMember: addMember.mutateAsync,
    removeMember: removeMemberMutation.mutateAsync,
    promoteToOfficer: promoteToOfficer.mutateAsync,
    demoteOfficer: demoteOfficer.mutateAsync,
    promoteToMayor: promoteToMayor.mutateAsync,
    demoteMayor: demoteMayor.mutateAsync,
  };
}