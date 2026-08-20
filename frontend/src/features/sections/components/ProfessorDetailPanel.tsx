// frontend/src/features/sections/components/ProfessorDetailPanel.tsx
import { XMarkIcon, ChatBubbleLeftIcon, CalendarIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { TeachingAssignment } from '@/types/section.types';

interface ProfessorDetailPanelProps {
  /** All of this professor's subject assignments within the one section
   * being viewed - never show one professor card/panel per subject. */
  assignments: TeachingAssignment[];
  sectionName: string;
  onClose: () => void;
  onMessage: () => void;
  isMessaging?: boolean;
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function ProfessorDetailPanel({
  assignments,
  sectionName,
  onClose,
  onMessage,
  isMessaging,
}: ProfessorDetailPanelProps) {
  const first = assignments[0];
  const fullName = first.professor_first_name
    ? `${first.professor_first_name} ${first.professor_last_name || ''}`.trim()
    : first.professor_username || 'Professor';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="w-full max-w-sm rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)] p-6 max-h-[90vh] overflow-y-auto themed-scrollbar">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold text-[#F1F5F9]">Professor</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-full transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <Avatar src={first.professor_avatar} name={fullName} size="lg" />
          <p className="mt-3 font-semibold text-[#F1F5F9]">{fullName}</p>
          <RoleBadge role="professor" className="mt-1.5" />
          <p className="text-xs text-[#64748B] mt-1">{sectionName}</p>
        </div>

        <div className="mt-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-2">
            <BookOpenIcon className="h-3.5 w-3.5" />
            Subjects
          </p>
          <div className="space-y-2">
            {assignments.map((ta) => (
              <div key={ta.id} className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-3">
                <p className="text-sm font-semibold text-[#F1F5F9]">{ta.subject}</p>
                {ta.schedule_days.length > 0 && ta.schedule_start && ta.schedule_end ? (
                  <div className="flex items-start gap-1.5 mt-1.5">
                    <CalendarIcon className="h-3.5 w-3.5 text-[#64748B] mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-[#94A3B8]">
                      {ta.schedule_days.join(', ')}
                      <br />
                      {formatTime(ta.schedule_start)} - {formatTime(ta.schedule_end)}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[#64748B] mt-1.5">Schedule not set</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onMessage}
          disabled={isMessaging}
          className="w-full mt-5 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold border border-[#00C8FF]/30 bg-[#00C8FF]/10 text-[#00C8FF] rounded-xl hover:bg-[#00C8FF]/20 transition disabled:opacity-50"
        >
          <ChatBubbleLeftIcon className="h-4 w-4" />
          Message Professor
        </button>
      </div>
    </div>
  );
}
