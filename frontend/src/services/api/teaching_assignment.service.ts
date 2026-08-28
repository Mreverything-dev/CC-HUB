// frontend/src/services/api/teaching_assignment.service.ts
import { api } from '@/lib/axios';
import { TeachingAssignment, TeachingAssignmentCreate, TeachingAssignmentUpdate, TeachingAssignmentAttendanceEntry } from '@/types/section.types';

export const teachingAssignmentApi = {
  joinSection: (sectionId: string, data: TeachingAssignmentCreate) =>
    api.post<TeachingAssignment>(`/sections/${sectionId}/teaching-assignments`, data),
  getForSection: (sectionId: string) =>
    api.get<TeachingAssignment[]>(`/sections/${sectionId}/teaching-assignments`),
  getMine: () => api.get<TeachingAssignment[]>('/teaching-assignments/mine'),
  update: (id: string, data: TeachingAssignmentUpdate) =>
    api.put<TeachingAssignment>(`/teaching-assignments/${id}`, data),
  remove: (id: string) => api.delete(`/teaching-assignments/${id}`),
  getAttendance: (id: string) =>
    api.get<TeachingAssignmentAttendanceEntry[]>(`/teaching-assignments/${id}/attendance`),
};
