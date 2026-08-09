// frontend/src/features/sections/components/SectionCard.tsx
import { Section } from '@/types/section.types';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { UsersIcon, AcademicCapIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import SectionDetailModal from '../components/SectionDetailModal';

interface SectionCardProps {
  section: Section;
  onRefresh: () => void;
}

export default function SectionCard({ section, onRefresh }: SectionCardProps) {
  const { user } = useAuthStore();
  const [showDetail, setShowDetail] = useState(false);
  const canManage = user?.role === 'admin' || user?.id === section.advisor_id;

  return (
    <>
      <div 
        className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => setShowDetail(true)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{section.name}</h3>
            {section.course && (
              <p className="text-sm text-gray-600">{section.course}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <UsersIcon className="h-4 w-4" />
                {section.member_count || 0} students
              </span>
              {section.year_level && (
                <span className="flex items-center gap-1">
                  <AcademicCapIcon className="h-4 w-4" />
                  Year {section.year_level}
                </span>
              )}
              {section.academic_year && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4" />
                  {section.academic_year}
                </span>
              )}
            </div>
          </div>
          {canManage && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              Advisor
            </span>
          )}
        </div>
      </div>

      {showDetail && (
        <SectionDetailModal
          section={section}
          onClose={() => setShowDetail(false)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}