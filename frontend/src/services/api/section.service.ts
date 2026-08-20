// frontend/src/services/api/section.service.ts
import { api } from '@/lib/axios';
import { Section, SectionCreate, SectionUpdate, SectionMember, SectionBrowseItem } from '@/types/section.types';

export const sectionApi = {
  // Sections
  getSections: () => api.get<Section[]>('/sections/'),
  getSection: (id: string) => api.get<Section>(`/sections/${id}`),
  createSection: (data: SectionCreate) => api.post<Section>('/sections/', data),
  updateSection: (id: string, data: SectionUpdate) => api.put<Section>(`/sections/${id}`, data),
  deleteSection: (id: string) => api.delete(`/sections/${id}`),
  browseSections: (params: { year_level?: number; name?: string }) =>
    api.get<SectionBrowseItem[]>('/sections/browse', { params }),
  
  // Members
  getSectionMembers: (sectionId: string) => api.get<SectionMember[]>(`/sections/${sectionId}/members`),
  addMember: (sectionId: string, userId: string) => 
    api.post<SectionMember>(`/sections/${sectionId}/members`, { user_id: userId }),
  removeMember: (sectionId: string, userId: string) => 
    api.delete(`/sections/${sectionId}/members/${userId}`),
  
  // Promotions
  promoteToOfficer: (sectionId: string, userId: string) =>
    api.post(`/sections/${sectionId}/members/${userId}/promote-officer`),
  demoteOfficer: (sectionId: string, userId: string) =>
    api.post(`/sections/${sectionId}/members/${userId}/demote-officer`),
  promoteToMayor: (sectionId: string, userId: string) =>
    api.post(`/sections/${sectionId}/members/${userId}/promote-mayor`),
  demoteMayor: (sectionId: string, userId: string) =>
    api.post(`/sections/${sectionId}/members/${userId}/demote-mayor`),
};