// frontend/src/features/sections/components/StudentRecordModal.tsx
import { useEffect, useState } from 'react';
import { XMarkIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { teachingAssignmentApi } from '@/services/api/teaching_assignment.service';
import { TeachingAssignment, TeachingAssignmentAttendanceEntry } from '@/types/section.types';

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
  /** The viewing professor's own teaching assignments in this student's
   * section - already on hand from ProfessorTeachingHub's data, reused here
   * to know which subjects to pull attendance for (usually just one). */
  assignments: TeachingAssignment[];
  onClose: () => void;
}

const ATTENDANCE_LABEL: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  excused: 'Excused',
  absent: 'Absent',
};

const ATTENDANCE_CLASS: Record<string, string> = {
  present: 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/30',
  late: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30',
  excused: 'text-[#3B9EFF] bg-[#3B9EFF]/10 border-[#3B9EFF]/30',
  absent: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/30',
};

interface SubjectAttendance {
  subject: string;
  entries: TeachingAssignmentAttendanceEntry[];
}

/**
 * Profile view backed by real data already on hand (no extra fetch needed
 * for identity - the caller already has it from the section's member list).
 * Attendance is real, persisted data pulled from the same
 * MeethubAttendanceRecord rows Meethub's in-meeting Attendance tab writes -
 * one fetch per subject the viewing professor teaches in this section.
 * Violations still has no backend anywhere in this app, so it intentionally
 * renders an honest empty state rather than fabricated numbers.
 */
export default function StudentRecordModal({ student, assignments, onClose }: StudentRecordModalProps) {
  const [attendance, setAttendance] = useState<SubjectAttendance[]>([]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingAttendance(true);
    Promise.all(
      assignments.map((ta) =>
        teachingAssignmentApi
          .getAttendance(ta.id)
          .then((res) => ({
            subject: ta.subject,
            entries: res.data.filter((e) => e.user_id === student.userId),
          }))
          .catch(() => ({ subject: ta.subject, entries: [] as TeachingAssignmentAttendanceEntry[] }))
      )
    ).then((results) => {
      if (!cancelled) setAttendance(results.filter((r) => r.entries.length > 0));
    }).finally(() => {
      if (!cancelled) setIsLoadingAttendance(false);
    });
    return () => {
      cancelled = true;
    };
  }, [assignments, student.userId]);

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
          {isLoadingAttendance ? (
            <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-4 text-center">
              <p className="text-sm text-[#64748B]">Loading...</p>
            </div>
          ) : attendance.length === 0 ? (
            <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-4 text-center">
              <p className="text-sm text-[#64748B]">No attendance records yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendance.map((group) => (
                <div key={group.subject} className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-3">
                  <p className="text-xs font-semibold text-[#F1F5F9] mb-2">{group.subject}</p>
                  <div className="space-y-1.5">
                    {group.entries.map((entry) => (
                      <div key={entry.session_id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[#94A3B8] truncate">
                          {entry.started_at ? new Date(entry.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : entry.session_title}
                        </span>
                        <span className={`flex-shrink-0 font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 border text-[10px] ${ATTENDANCE_CLASS[entry.status] || 'text-[#94A3B8] bg-white/5 border-[#1E3447]'}`}>
                          {ATTENDANCE_LABEL[entry.status] || entry.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
