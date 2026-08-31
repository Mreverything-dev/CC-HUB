// frontend/src/features/sections/components/ProfessorDetailsModal.tsx
import { XMarkIcon, ChatBubbleLeftIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { TeachingAssignment } from '@/types/section.types';
import { formatScheduleTime } from '@/lib/formatters';

interface ProfessorDetailsModalProps {
  /** Every active teaching assignment for ONE professor in this section -
   * one entry per subject they teach here. Reuses the exact same
   * TeachingAssignment rows the main Professor card and its "View other
   * professors" switcher already work with; no separate data/API. */
  assignments: TeachingAssignment[];
  onClose: () => void;
  onMessage?: () => void;
  isMessaging?: boolean;
  showMessageButton: boolean;
}

export function ProfessorDetailsModal({
  assignments,
  onClose,
  onMessage,
  isMessaging,
  showMessageButton,
}: ProfessorDetailsModalProps) {
  const first = assignments[0];
  const fullName = first.professor_first_name
    ? `${first.professor_first_name} ${first.professor_last_name || ''}`.trim()
    : first.professor_username || 'Professor';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)] themed-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1E3447]">
          <h2 className="text-lg font-bold text-[#F1F5F9]">Professor Details</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] rounded-full hover:bg-white/5 transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-3.5">
            <Avatar src={first.professor_avatar} name={fullName} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-[#F1F5F9] truncate">Prof. {fullName}</p>
              <RoleBadge role="professor" className="mt-1" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-2">
              {assignments.length > 1 ? 'Subjects' : 'Subject'}
            </p>
            <div className="space-y-2.5">
              {assignments.map((ta) => (
                <div key={ta.id} className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-3.5">
                  <p className="text-sm font-semibold text-[#F1F5F9]">
                    {ta.subject}
                    {ta.subject_code && (
                      <span className="ml-1.5 text-xs font-normal text-[#64748B]">({ta.subject_code})</span>
                    )}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    <p className="flex items-start gap-1.5 text-xs text-[#94A3B8]">
                      <ClockIcon className="h-3.5 w-3.5 flex-shrink-0 text-[#64748B] mt-0.5" />
                      {ta.schedule_days.length > 0 && ta.schedule_start && ta.schedule_end
                        ? `${ta.schedule_days.join(', ')} · ${formatScheduleTime(ta.schedule_start)}-${formatScheduleTime(ta.schedule_end)}`
                        : 'Schedule not set'}
                    </p>
                    <p className="flex items-start gap-1.5 text-xs text-[#94A3B8]">
                      <MapPinIcon className="h-3.5 w-3.5 flex-shrink-0 text-[#64748B] mt-0.5" />
                      {ta.room || 'Room not set'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showMessageButton && (
            <button
              onClick={onMessage}
              disabled={isMessaging}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold border border-[#00C8FF]/30 bg-[#00C8FF]/10 text-[#00C8FF] rounded-xl hover:bg-[#00C8FF]/20 transition disabled:opacity-50"
            >
              <ChatBubbleLeftIcon className="h-4 w-4" />
              Message
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
