// frontend/src/features/sections/components/SectionManager.tsx
import { useState } from 'react';
import { useSections } from '../hooks/useSections';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { PlusIcon } from '@heroicons/react/24/outline';
import SectionCard from './SectionCard';
import { SectionCardSkeleton } from './SectionCardSkeleton';
import CreateSectionModal from './CreateSectionModal';


export default function SectionManager() {
  const { user } = useAuthStore();
  const { sections, isLoading, refetch } = useSections();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ✅ Professors and Admins can create sections
  const canCreate = user?.role === 'professor' || user?.role === 'admin';

  // ✅ Students can see sections they are members of
  const visibleSections = sections || [];

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-[#F1F5F9]">My Sections</h2>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition"
          >
            <PlusIcon className="h-4 w-4" />
            New Section
          </button>
        )}
      </div>

      {/* Sections Grid */}
      {isLoading && sections.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <SectionCardSkeleton key={i} />
          ))}
        </div>
      ) : visibleSections.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-[#1E3447] bg-[#0D1722]/70 backdrop-blur-xl">
          <p className="text-[#94A3B8]">
            {user?.role === 'student'
              ? 'You are not enrolled in any sections yet.'
              : 'No sections yet.'}
          </p>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-sm text-[#00C8FF] hover:underline font-medium"
            >
              Create your first section
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleSections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              onRefresh={refetch}
            />
          ))}
        </div>
      )}

      {/* Create Section Modal */}
      {showCreateModal && (
        <CreateSectionModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
