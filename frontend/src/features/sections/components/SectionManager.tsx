// frontend/src/features/sections/components/SectionManager.tsx
import { useState } from 'react';
import { useSections } from '../hooks/useSections';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { PlusIcon } from '@heroicons/react/24/outline';
import SectionCard from './SectionCard';
import CreateSectionModal from './CreateSectionModal';

export default function SectionManager() {
  const { user } = useAuthStore();
  const { sections, isLoading, refetch } = useSections();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const canCreate = user?.role === 'professor' || user?.role === 'admin';

  if (isLoading && sections.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">My Sections</h2>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            <PlusIcon className="h-5 w-5" />
            New Section
          </button>
        )}
      </div>

      {/* Sections Grid */}
      {sections.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No sections yet.</p>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first section
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((section) => (
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