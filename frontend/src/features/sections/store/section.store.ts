// frontend/src/features/sections/store/section.store.ts
import { create } from 'zustand';
import { Section, SectionMember } from '@/types/section.types';

interface SectionStore {
  sections: Section[];
  currentSection: Section | null;
  isLoading: boolean;
  error: string | null;
  setSections: (sections: Section[]) => void;
  setCurrentSection: (section: Section | null) => void;
  addSection: (section: Section) => void;
  updateSection: (id: string, data: Partial<Section>) => void;
  removeSection: (id: string) => void;
  updateMember: (sectionId: string, member: SectionMember) => void;
  removeMember: (sectionId: string, userId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSectionStore = create<SectionStore>((set) => ({
  sections: [],
  currentSection: null,
  isLoading: false,
  error: null,
  
  setSections: (sections) => set({ sections }),
  
  setCurrentSection: (currentSection) => set({ currentSection }),
  
  addSection: (section) => set((state) => ({
    sections: [section, ...state.sections]
  })),
  
  updateSection: (id, data) => set((state) => ({
    sections: state.sections.map((s) =>
      s.id === id ? { ...s, ...data } : s
    ),
    currentSection: state.currentSection?.id === id
      ? { ...state.currentSection, ...data }
      : state.currentSection
  })),
  
  removeSection: (id) => set((state) => ({
    sections: state.sections.filter((s) => s.id !== id),
    currentSection: state.currentSection?.id === id ? null : state.currentSection
  })),
  
  updateMember: (sectionId, member) => set((state) => {
    const updateMembers = (section: Section) => ({
      ...section,
      members: section.members?.map((m) =>
        m.id === member.id ? member : m
      ) || []
    });
    
    return {
      sections: state.sections.map((s) =>
        s.id === sectionId ? updateMembers(s) : s
      ),
      currentSection: state.currentSection?.id === sectionId
        ? updateMembers(state.currentSection)
        : state.currentSection
    };
  }),
  
  removeMember: (sectionId, userId) => set((state) => {
    const removeFromMembers = (section: Section) => ({
      ...section,
      members: section.members?.filter((m) => m.user_id !== userId) || [],
      member_count: (section.member_count || 1) - 1
    });
    
    return {
      sections: state.sections.map((s) =>
        s.id === sectionId ? removeFromMembers(s) : s
      ),
      currentSection: state.currentSection?.id === sectionId
        ? removeFromMembers(state.currentSection)
        : state.currentSection
    };
  }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),
}));