// frontend/src/features/sections/components/SectionCard.tsx
import { useState } from 'react';
import {
  UsersIcon,
  AcademicCapIcon,
  CalendarIcon,
  EllipsisVerticalIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { Section } from '@/types/section.types';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSections } from '../hooks/useSections';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import SectionDetailModal from './SectionDetailModal';

interface SectionCardProps {
  section: Section;
  onRefresh: () => void;
}

export default function SectionCard({ section, onRefresh }: SectionCardProps) {
  const { user } = useAuthStore();
  const { deleteSection } = useSections();
  const [showDetail, setShowDetail] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // ✅ Only the owning advisor or an admin may delete - matches the backend's
  // authorization check in SectionService.delete_section, so this never shows
  // a button that would just 403.
  const canDelete = user?.role === 'admin' || user?.id === section.advisor_id;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSection(section.id);
      setShowDeleteConfirm(false);
      onRefresh();
    } catch {
      // useSections' deleteSection mutation already surfaces a toast on error
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div
        className="rounded-2xl border border-[#1E3447] bg-[#0D1722]/70 backdrop-blur-xl p-5 hover:border-[#00C8FF]/40 hover:shadow-[0_0_20px_rgba(0,200,255,0.08)] transition-all cursor-pointer relative"
        onClick={() => setShowDetail(true)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[#F1F5F9] truncate">{section.name}</h3>
              <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-medium text-[#22C55E]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                Active
              </span>
            </div>
            {section.course && (
              <p className="text-sm text-[#94A3B8] truncate">{section.course}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-[#64748B]">
              <span className="flex items-center gap-1">
                <UsersIcon className="h-3.5 w-3.5" />
                {section.member_count || 0} students
              </span>
              {section.year_level && (
                <span className="flex items-center gap-1">
                  <AcademicCapIcon className="h-3.5 w-3.5" />
                  Year {section.year_level}
                </span>
              )}
              {section.academic_year && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {section.academic_year}
                </span>
              )}
            </div>

            {isMember && (isMayor || isOfficer) && (
              <div className="mt-2 flex items-center gap-2">
                {isMayor && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-full px-2 py-0.5">
                    Class Mayor
                  </span>
                )}
                {isOfficer && !isMayor && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#00C8FF] bg-[#00C8FF]/10 border border-[#00C8FF]/30 rounded-full px-2 py-0.5">
                    Officer
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 3-dot menu - delete is only offered to the owning advisor/admin */}
          {canDelete && (
            <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                title="Section options"
                className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] rounded-lg hover:bg-white/5 transition"
              >
                <EllipsisVerticalIcon className="h-5 w-5" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl z-20 overflow-hidden">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#EF4444] hover:bg-[#EF4444]/10 transition"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete Section
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Member avatars */}
        {section.members && section.members.length > 0 && (
          <div className="flex items-center mt-3 -space-x-2">
            {section.members.slice(0, 6).map((m) => (
              <Avatar
                key={m.id}
                src={m.user_avatar}
                name={m.user_username || undefined}
                size="xs"
                className="ring-2 ring-[#0D1722]"
              />
            ))}
            {section.member_count > 6 && (
              <div className="w-7 h-7 rounded-full bg-[#162534] ring-2 ring-[#0D1722] flex items-center justify-center text-[10px] font-medium text-[#94A3B8]">
                +{section.member_count - 6}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#1E3447]">
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
              canManage
                ? 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/30'
                : 'text-[#94A3B8] bg-white/5 border-[#1E3447]'
            }`}
          >
            {canManage ? 'Manage' : 'Member'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDetail(true);
            }}
            className="text-xs font-medium text-[#00C8FF] hover:text-[#F1F5F9] hover:bg-[#00C8FF]/10 rounded-lg px-3 py-1.5 transition"
          >
            Manage
          </button>
        </div>
      </div>

      {showDetail && (
        <SectionDetailModal
          section={section}
          onClose={() => setShowDetail(false)}
          onRefresh={onRefresh}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Section"
          message={
            <>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-[#F1F5F9]">"{section.name}"</span>? This will
              permanently remove the section along with its members, targeted announcements, and
              related data. This action cannot be undone.
            </>
          }
          confirmLabel="Delete Section"
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
