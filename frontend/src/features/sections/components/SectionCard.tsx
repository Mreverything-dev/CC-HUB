// frontend/src/features/sections/components/SectionCard.tsx
import { Section } from '@/types/section.types';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { UsersIcon, AcademicCapIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import SectionDetailModal from './SectionDetailModal';

interface SectionCardProps {
  section: Section;
  onRefresh: () => void;
}

export default function SectionCard({ section, onRefresh }: SectionCardProps) {
  const { user } = useAuthStore();
  const [showDetail, setShowDetail] = useState(false);

  // ✅ Check if user is a member of this section
  const isMember = section.members?.some(m => m.user_id === user?.id) || false;
  
  // ✅ Check if user has a role in this section
  const userMember = section.members?.find(m => m.user_id === user?.id);
  const isOfficer = userMember?.is_officer || false;
  const isMayor = userMember?.is_mayor || false;

  // ✅ Can manage: Admin, Professor (advisor), or Officer/Mayor
  const canManage = user?.role === 'admin' || 
                    user?.id === section.advisor_id ||
                    isOfficer ||
                    isMayor;

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
            {/* ✅ Show user's role in section */}
            {isMember && (
              <div className="mt-2 flex items-center gap-2">
                {isMayor && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
                    Class Mayor
                  </span>
                )}
                {isOfficer && !isMayor && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                    Officer
                  </span>
                )}
              </div>
            )}
          </div>
          {(canManage || isMember) && (
            <span className={`text-xs px-2 py-1 rounded-full ${canManage ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {canManage ? 'Manage' : 'Member'}
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