// frontend/src/features/dashboard/pages/ClassesPage.tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  ClockIcon,
  UserGroupIcon,
  XMarkIcon,
  ChatBubbleLeftIcon,
  Cog6ToothIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChat } from '@/features/chat/hooks/useChat';
import { Avatar } from '../components/Avatar';
import { ClassOccurrence, OccurrenceStatus, formatTimeRange } from '../utils/todayClasses';
import { motion, AnimatePresence } from 'framer-motion';

interface ClassesPageProps {
  occurrences: ClassOccurrence[];
  sectionsCount: number;
  totalHours: number;
  isLoading: boolean;
  onOpenSection?: (sectionId: string) => void;
}

const STATUS_STYLES: Record<OccurrenceStatus, string> = {
  now: 'bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_20px_rgba(52,211,153,0.15)]',
  next: 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_20px_rgba(0,200,255,0.15)]',
  upcoming: 'bg-white/5 text-slate-400 border-slate-700/50',
  completed: 'bg-white/5 text-slate-500 border-slate-700/30 opacity-60',
};

const STATUS_LABELS: Record<OccurrenceStatus, string> = {
  now: '● LIVE',
  next: '◆ NEXT',
  upcoming: '○ UPCOMING',
  completed: '✓ DONE',
};

// Row treatment for the schedule table - a subtle left accent + background
// tint instead of a text badge, so the table itself stays as close to the
// reference "clean spreadsheet" look as possible.
const ROW_ACCENT: Record<OccurrenceStatus, string> = {
  now: 'border-l-emerald-400 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07]',
  next: 'border-l-cyan-400 bg-cyan-500/[0.04] hover:bg-cyan-500/[0.07]',
  upcoming: 'border-l-transparent hover:bg-white/[0.03]',
  completed: 'border-l-transparent opacity-50 hover:opacity-75 hover:bg-white/[0.03]',
};

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function StatChip({ icon: Icon, value, label, accent, gradient }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  value: number;
  label: string;
  accent: string;
  gradient: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2 }}
      className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-xl px-4 py-3 shadow-xl"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5`} />
      <div className="relative flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-sm">
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-white leading-tight tracking-tight">{value}</p>
          <p className="text-xs text-slate-400 truncate font-medium">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function ClassesPage({ occurrences, sectionsCount, totalHours, isLoading, onOpenSection }: ClassesPageProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { createDirectConversation, openWidget } = useChat();
  const isProfessor = user?.role === 'professor';

  const [selected, setSelected] = useState<ClassOccurrence | null>(null);
  const [messaging, setMessaging] = useState(false);

  const totalClasses = useMemo(() => new Set(occurrences.map((o) => o.assignmentId)).size, [occurrences]);
  const todayCount = useMemo(() => occurrences.filter((o) => o.isToday).length, [occurrences]);

  // One row per scheduled occurrence (a Mon/Wed/Fri subject appears three
  // times), ordered like a real weekly timetable - Monday through Sunday,
  // earliest time first - rather than grouped by "today/upcoming/status".
  const schedule = useMemo(
    () =>
      [...occurrences].sort((a, b) => {
        const dayDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
        if (dayDiff !== 0) return dayDiff;
        return a.scheduleStart.localeCompare(b.scheduleStart);
      }),
    [occurrences]
  );

  const handleMessageProfessor = async (professorId: string) => {
    setMessaging(true);
    try {
      await createDirectConversation(professorId);
      openWidget();
      setSelected(null);
    } finally {
      setMessaging(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="relative mb-8">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur-xl opacity-20" />
            <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/20">
              <AcademicCapIcon className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              My Schedule
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Your weekly class timetable</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        >
          <StatChip icon={BookOpenIcon} value={totalClasses} label="Total Classes" accent="#8B5CF6" gradient="from-purple-500 to-indigo-500" />
          <StatChip icon={CalendarDaysIcon} value={todayCount} label="Today's Classes" accent="#22D3EE" gradient="from-cyan-500 to-blue-500" />
          <StatChip icon={UserGroupIcon} value={sectionsCount} label="Sections" accent="#F59E0B" gradient="from-amber-500 to-orange-500" />
          <StatChip icon={ClockIcon} value={totalHours} label="Total Hours" accent="#34D399" gradient="from-emerald-500 to-teal-500" />
        </motion.div>
      )}

      {/* Schedule table */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-slate-800/20 animate-pulse border border-slate-700/30" />
          ))}
        </div>
      ) : schedule.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/30 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-xl p-12 text-center">
          <BookOpenIcon className="h-12 w-12 mx-auto text-slate-600" />
          <p className="text-slate-400 mt-3 text-sm">No classes scheduled yet.</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-xl shadow-xl overflow-hidden"
        >
          <div className="overflow-x-auto themed-scrollbar">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-white/[0.03]">
                  <th className="text-left font-semibold text-slate-400 text-xs uppercase tracking-wider px-4 py-3">Day</th>
                  <th className="text-left font-semibold text-slate-400 text-xs uppercase tracking-wider px-4 py-3">Time</th>
                  <th className="text-left font-semibold text-slate-400 text-xs uppercase tracking-wider px-4 py-3">Code</th>
                  <th className="text-left font-semibold text-slate-400 text-xs uppercase tracking-wider px-4 py-3">Subject</th>
                  <th className="text-left font-semibold text-slate-400 text-xs uppercase tracking-wider px-4 py-3">
                    {isProfessor ? 'Section' : 'Professor'}
                  </th>
                  <th className="text-left font-semibold text-slate-400 text-xs uppercase tracking-wider px-4 py-3">Room</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((occ) => (
                  <tr
                    key={occ.id}
                    onClick={() => setSelected(occ)}
                    className={`cursor-pointer border-b border-slate-800/60 last:border-0 border-l-2 transition-colors ${ROW_ACCENT[occ.status]}`}
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center justify-center min-w-[3.25rem] rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                          occ.status === 'now'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : occ.status === 'next'
                            ? 'bg-cyan-500/15 text-cyan-400'
                            : 'bg-white/5 text-slate-300'
                        }`}
                      >
                        {occ.day}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-300 font-medium">
                      {formatTimeRange(occ.scheduleStart, occ.scheduleEnd)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 font-mono text-xs">
                      {occ.assignment.subject_code || '—'}
                    </td>
                    <td className="px-4 py-3.5 min-w-[180px]">
                      <p className="font-semibold text-white">{occ.subject}</p>
                    </td>
                    <td className="px-4 py-3.5 min-w-[180px]">
                      {isProfessor ? (
                        <span className="text-slate-300">{occ.secondaryMeta || occ.primaryMeta}</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Avatar src={occ.assignment.professor_avatar} name={occ.primaryMeta.replace(/^Prof\.\s*/, '')} size="xs" />
                          <span className="text-slate-300 truncate">{occ.primaryMeta}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-300">{occ.assignment.room || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Class Details Modal */}
      <AnimatePresence>
        {selected && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal content */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-white">
                    {selected.subject}
                    {selected.assignment.subject_code && (
                      <span className="ml-1.5 text-sm font-medium text-slate-400">({selected.assignment.subject_code})</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-semibold uppercase tracking-wide rounded-full px-3 py-1 border ${STATUS_STYLES[selected.status]}`}>
                      {STATUS_LABELS[selected.status]}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {!isProfessor && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
                    <Avatar
                      src={selected.assignment.professor_avatar}
                      name={selected.primaryMeta.replace(/^Prof\.\s*/, '')}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{selected.primaryMeta}</p>
                      <p className="text-xs text-slate-400">Professor</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  <div>
                    <p className="text-xs text-slate-400">Section</p>
                    <p className="text-sm font-medium text-white mt-0.5">
                      {isProfessor ? selected.primaryMeta : selected.secondaryMeta || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Schedule</p>
                    <p className="text-sm font-medium text-white mt-0.5">
                      {selected.assignment.schedule_days.join(', ')}
                      <br />
                      <span className="text-xs text-slate-400">
                        {formatTimeRange(selected.scheduleStart, selected.scheduleEnd)}
                      </span>
                    </p>
                  </div>
                  {selected.assignment.room && (
                    <div>
                      <p className="text-xs text-slate-400">Room</p>
                      <p className="text-sm font-medium text-white mt-0.5">{selected.assignment.room}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {isProfessor && onOpenSection && (
                    <button
                      onClick={() => {
                        onOpenSection(selected.assignment.section_id);
                        setSelected(null);
                      }}
                      className="flex items-center justify-center gap-2 py-3 text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:opacity-90 transition shadow-lg shadow-cyan-500/25"
                    >
                      <Cog6ToothIcon className="h-4 w-4" />
                      Manage Section
                    </button>
                  )}
                  {!isProfessor && selected.assignment.professor_id && selected.assignment.professor_id !== user?.id && (
                    <button
                      onClick={() => handleMessageProfessor(selected.assignment.professor_id)}
                      disabled={messaging}
                      className="flex items-center justify-center gap-2 py-3 text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:opacity-90 transition disabled:opacity-50 shadow-lg shadow-cyan-500/25"
                    >
                      <ChatBubbleLeftIcon className="h-4 w-4" />
                      {messaging ? 'Opening chat...' : 'Message Professor'}
                    </button>
                  )}
                  {!isProfessor && (
                    <button
                      onClick={() => {
                        navigate(`/profile/${selected.assignment.professor_id}`);
                        setSelected(null);
                      }}
                      className="py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition"
                    >
                      View Professor Profile
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
