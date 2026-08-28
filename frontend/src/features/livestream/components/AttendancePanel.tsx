// frontend/src/features/livestream/components/AttendancePanel.tsx
import { Avatar } from '@/features/dashboard/components/Avatar';
import { AttendanceRosterEntry, AttendanceStatus } from '@/types/meethub.types';
import { formatParticipantName, sortParticipants } from '../utils/participantName';

interface AttendancePanelProps {
  roster: AttendanceRosterEntry[];
  isOrganizer: boolean;
  onMark: (userId: string, status: AttendanceStatus) => void;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: 'present', label: 'Present', activeClass: 'bg-[#22C55E] text-[#060B12]' },
  { value: 'late', label: 'Late', activeClass: 'bg-[#F59E0B] text-[#060B12]' },
  { value: 'excused', label: 'Excused', activeClass: 'bg-[#3B9EFF] text-[#060B12]' },
  { value: 'absent', label: 'Absent', activeClass: 'bg-[#EF4444] text-white' },
];

export function statusBadgeClass(status: AttendanceStatus | null): string {
  if (!status) return 'bg-[#1E3447] text-[#94A3B8]';
  return STATUS_OPTIONS.find((o) => o.value === status)?.activeClass || 'bg-[#1E3447] text-[#94A3B8]';
}

export function statusLabel(status: AttendanceStatus | null): string {
  if (!status) return 'Not Marked';
  return STATUS_OPTIONS.find((o) => o.value === status)?.label || status;
}

/**
 * Embeddable attendance tab content (rendered as a tab pane inside
 * MeethubRoom's right panel, not a standalone modal) - shows every student
 * in the class section, not just who has joined so far. Marking controls
 * only render for the organizer; the backend independently enforces this
 * regardless of what the UI shows.
 */
export function AttendancePanel({ roster, isOrganizer, onMark }: AttendancePanelProps) {
  const presentCount = roster.filter((r) => r.status === 'present' || r.status === 'late').length;
  const absentCount = roster.filter((r) => r.status === 'absent').length;
  const notMarkedCount = roster.filter((r) => !r.status).length;
  // Alphabetical by last name (falling back to username) - display-only,
  // never mutates the roster the marking logic itself operates on.
  const sortedRoster = sortParticipants(roster);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-4 gap-2 p-3 border-b border-[#1E3447] flex-shrink-0">
        <div className="text-center">
          <p className="text-lg font-bold text-[#22C55E]">{presentCount}</p>
          <p className="text-[10px] text-[#64748B] uppercase tracking-wide">Present</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-[#EF4444]">{absentCount}</p>
          <p className="text-[10px] text-[#64748B] uppercase tracking-wide">Absent</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-[#94A3B8]">{notMarkedCount}</p>
          <p className="text-[10px] text-[#64748B] uppercase tracking-wide">Unmarked</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-[#F1F5F9]">{roster.length}</p>
          <p className="text-[10px] text-[#64748B] uppercase tracking-wide">Total</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sortedRoster.length === 0 ? (
          <p className="text-center text-sm text-[#64748B] py-8">No students in this section.</p>
        ) : (
          sortedRoster.map((entry) => (
            <div key={entry.user_id} className="p-2 rounded-lg bg-[#0D1722] border border-[#1E3447]">
              <div className="flex items-center gap-2.5">
                <div className="relative flex-shrink-0">
                  <Avatar src={entry.avatar} name={formatParticipantName(entry)} size="sm" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0D1722] ${
                      entry.is_online ? 'bg-[#22C55E]' : 'bg-[#64748B]'
                    }`}
                    title={entry.is_online ? 'Online' : 'Offline'}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#F1F5F9] truncate">
                    {formatParticipantName(entry)}
                    {entry.is_mayor && ' 👑'}
                  </p>
                  <p className="text-[10px] text-[#64748B]">{entry.is_online ? 'Online' : 'Offline'}</p>
                </div>
                {!isOrganizer && (
                  <span className={`flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-semibold uppercase ${statusBadgeClass(entry.status)}`}>
                    {statusLabel(entry.status)}
                  </span>
                )}
              </div>
              {/* Mark buttons sit on their own row below the name so a long
                  name (e.g. "Last Name, First Name") never squeezes or
                  covers them - stays clean and aligned on both desktop and
                  the narrower mobile drawer. */}
              {isOrganizer && (
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onMark(entry.user_id, opt.value)}
                      className={`px-1.5 py-1.5 rounded-md text-[10px] font-semibold uppercase transition truncate ${
                        entry.status === opt.value ? opt.activeClass : 'bg-[#1E3447] text-[#94A3B8] hover:bg-[#243c52]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
