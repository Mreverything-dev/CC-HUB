// frontend/src/features/sections/components/StudentRecordModal.tsx
import { XMarkIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';

export interface StudentRecordTarget {
  userId: string;
  fullName: string;
  username?: string | null;
  avatarUrl?: string | null;
  sectionName: string;
  yearLevel?: number | null;
  roleLabel: 'Mayor' | 'Officer' | 'Student';
}

interface StudentRecordModalProps {
  student: StudentRecordTarget;
  onClose: () => void;
}

/**
 * Profile view backed by real data already on hand (no extra fetch needed -
 * the caller already has it from the section's member list). Attendance and
 * Violations have no backend yet anywhere in this app, so they intentionally
 * always render an honest empty state rather than fabricated numbers.
 */
export default function StudentRecordModal({ student, onClose }: StudentRecordModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="w-full max-w-sm rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)] p-6 max-h-[90vh] overflow-y-auto themed-scrollbar">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold text-[#F1F5F9]">Student Profile</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-full transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <Avatar src={student.avatarUrl} name={student.fullName} size="lg" />
          <p className="mt-3 font-semibold text-[#F1F5F9]">{student.fullName}</p>
          {student.username && <p className="text-xs text-[#64748B]">@{student.username}</p>}
          <div className="flex items-center gap-1.5 mt-1.5">
            <RoleBadge role="student" />
            {student.roleLabel !== 'Student' && (
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 border ${
                  student.roleLabel === 'Mayor'
                    ? 'text-[#F5B82E] bg-[#F5B82E]/10 border-[#F5B82E]/30'
                    : 'text-[#3B9EFF] bg-[#3B9EFF]/10 border-[#3B9EFF]/30'
                }`}
              >
                {student.roleLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            {student.sectionName}
            {student.yearLevel ? ` • Year ${student.yearLevel}` : ''}
          </p>
        </div>

        <div className="mt-5 pt-5 border-t border-[#1E3447]">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-2">
            <ClipboardDocumentListIcon className="h-3.5 w-3.5" />
            Attendance
          </p>
          <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-4 text-center">
            <p className="text-sm text-[#64748B]">No attendance records yet.</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-2">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
            Violations
          </p>
          <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-4 text-center">
            <p className="text-sm text-[#64748B]">No violations recorded.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
