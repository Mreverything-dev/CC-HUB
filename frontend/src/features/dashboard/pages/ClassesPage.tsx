// frontend/src/features/dashboard/pages/ClassesPage.tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  ClockIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
  XMarkIcon,
  ChatBubbleLeftIcon,
  Cog6ToothIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useChat } from '@/features/chat/hooks/useChat';
import { Avatar } from '../components/Avatar';
import { ClassOccurrence, OccurrenceStatus, formatTimeRange } from '../utils/todayClasses';

interface ClassesPageProps {
  occurrences: ClassOccurrence[];
  sectionsCount: number;
  totalHours: number;
  isLoading: boolean;
  /** Professor only - hands off to the existing "Manage Section" navigation
   * (ProfessorDashboard's selectedTeachingSectionId + SectionDashboard),
   * same callback shape ProfessorTeachingHub's onManageSection already uses. */
  onOpenSection?: (sectionId: string) => void;
}

type FilterTab = 'all' | 'today' | 'week';

const STATUS_STYLES: Record<OccurrenceStatus, string> = {
  now: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30',
  next: 'bg-[#00C8FF]/15 text-[#00C8FF] border-[#00C8FF]/30',
  upcoming: 'bg-white/5 text-[#94A3B8] border-[#1E3447]',
  completed: 'bg-white/5 text-[#64748B] border-[#1E3447]',
};

function StatChip({ icon: Icon, value, label, accent }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#1E3447] bg-[rgba(15,28,40,0.75)] backdrop-blur-xl px-4 py-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}1A`, color: accent }}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-[#F1F5F9] leading-tight">{value}</p>
        <p className="text-xs text-[#94A3B8] truncate">{label}</p>
      </div>
    </div>
  );
}

/**
 * Shared "Classes" page for both Student and Professor dashboards - the
 * parent page owns fetching (useSections / useTeachingAssignments, same
 * hooks ProfessorTeachingHub and the dashboards' own "Today's Class
 * Reminder" already use) and hands this component the already-computed
 * `occurrences` (see buildWeekOccurrences in utils/todayClasses.ts), so
 * there's exactly one schedule-computation implementation shared by the
 * reminder card, ProfessorTeachingHub's stats, and this page.
 */
export default function ClassesPage({ occurrences, sectionsCount, totalHours, isLoading, onOpenSection }: ClassesPageProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { createDirectConversation, openWidget } = useChat();
  const isProfessor = user?.role === 'professor';

  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClassOccurrence | null>(null);
  const [messaging, setMessaging] = useState(false);

  const totalClasses = useMemo(() => new Set(occurrences.map((o) => o.assignmentId)).size, [occurrences]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return occurrences;
    return occurrences.filter(
      (o) =>
        o.subject.toLowerCase().includes(q) ||
        o.primaryMeta.toLowerCase().includes(q) ||
        (o.secondaryMeta || '').toLowerCase().includes(q)
    );
  }, [occurrences, search]);

  const todayList = useMemo(() => searched.filter((o) => o.isToday), [searched]);
  const upcomingList = useMemo(
    () => searched.filter((o) => !o.isToday && o.status !== 'completed'),
    [searched]
  );
  // One row per distinct subject/assignment (not per occurrence) - a master
  // catalog of everything, regardless of day or status.
  const catalog = useMemo(() => {
    const seen = new Map<string, ClassOccurrence>();
    for (const o of searched) if (!seen.has(o.assignmentId)) seen.set(o.assignmentId, o);
    return Array.from(seen.values()).sort((a, b) => a.subject.localeCompare(b.subject));
  }, [searched]);

  const nextClass = occurrences.find((o) => o.status === 'next') || null;

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

  const renderCard = (occ: ClassOccurrence) => (
    <button
      key={occ.id}
      onClick={() => setSelected(occ)}
      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition ${
        occ.status === 'next'
          ? 'border-[#00C8FF]/40 bg-[#00C8FF]/[0.06] hover:bg-[#00C8FF]/10'
          : 'border-[#1E3447] bg-[#0A111A] hover:border-[#00C8FF]/30'
      }`}
    >
      {!isProfessor && (
        <Avatar src={occ.assignment.professor_avatar} name={occ.primaryMeta.replace(/^Prof\.\s*/, '')} size="sm" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#F1F5F9] truncate">{occ.subject}</p>
        <p className="text-xs text-[#94A3B8] truncate mt-0.5">
          {occ.primaryMeta}
          {occ.secondaryMeta ? ` • ${occ.secondaryMeta}` : ''}
        </p>
        <p className="text-xs text-[#64748B] mt-0.5">
          {occ.day} • {formatTimeRange(occ.scheduleStart, occ.scheduleEnd)}
        </p>
      </div>
      <span className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-1 border ${STATUS_STYLES[occ.status]}`}>
        {occ.status === 'now' ? 'NOW' : occ.status === 'next' ? 'NEXT' : occ.status === 'completed' ? 'DONE' : occ.statusLabel}
      </span>
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5 rounded-2xl border border-[rgba(0,200,245,0.18)] bg-[rgba(15,28,40,0.75)] backdrop-blur-xl p-5 sm:p-6 flex items-center gap-4">
        <div className="flex h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-[#00C8FF]/30 bg-[#00C8FF]/10 shadow-[0_0_20px_rgba(0,200,245,0.15)]">
          <AcademicCapIcon className="h-5 w-5 sm:h-6 sm:w-6 text-[#00C8FF]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[#F1F5F9]">Classes</h1>
          <p className="text-[#94A3B8] mt-0.5 text-sm">Your subjects and schedules.</p>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatChip icon={BookOpenIcon} value={totalClasses} label="Total Classes" accent="#8B5CF6" />
          <StatChip icon={CalendarDaysIcon} value={todayList.length} label="Today's Classes" accent="#00C8FF" />
          <StatChip icon={UserGroupIcon} value={sectionsCount} label="Sections" accent="#F59E0B" />
          <StatChip icon={ClockIcon} value={totalHours} label="Total Hours" accent="#22C55E" />
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, professor, or section..."
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-[#1E3447] bg-[#0A111A] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#F1F5F9] transition">
              <XCircleIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[#1E3447] bg-[#0A111A] p-1 flex-shrink-0">
          {([['all', 'All'], ['today', 'Today'], ['week', 'This Week']] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                filter === value ? 'bg-[#00C8FF] text-[#060B12]' : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-[#0D1722] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Today's Schedule */}
          {filter !== 'week' && (
            <div>
              <h2 className="text-sm font-semibold text-[#F1F5F9] mb-3">Today's Schedule</h2>
              {todayList.length === 0 ? (
                <div className="rounded-2xl border border-[#1E3447] bg-[rgba(15,28,40,0.75)] backdrop-blur-xl p-6 text-center">
                  <p className="text-[#F1F5F9] font-medium">No classes today 🎉</p>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    {nextClass
                      ? `Enjoy your free day! Your next class is ${nextClass.day} • ${formatTimeRange(nextClass.scheduleStart, nextClass.scheduleEnd)} (${nextClass.subject}).`
                      : 'Enjoy your free day!'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{todayList.map(renderCard)}</div>
              )}
            </div>
          )}

          {/* Upcoming Classes */}
          {filter !== 'today' && (
            <div>
              <h2 className="text-sm font-semibold text-[#F1F5F9] mb-3">Upcoming Classes</h2>
              {upcomingList.length === 0 ? (
                <p className="text-xs text-[#64748B] py-4 text-center rounded-2xl border border-[#1E3447] bg-[rgba(15,28,40,0.75)]">
                  Nothing else scheduled for the rest of this week.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{upcomingList.map(renderCard)}</div>
              )}
            </div>
          )}

          {/* All Classes - the full catalog, one row per subject regardless of day */}
          {filter === 'all' && (
            <div>
              <h2 className="text-sm font-semibold text-[#F1F5F9] mb-3">All Classes</h2>
              {catalog.length === 0 ? (
                <div className="rounded-2xl border border-[#1E3447] bg-[rgba(15,28,40,0.75)] backdrop-blur-xl py-10 text-center">
                  <BookOpenIcon className="h-8 w-8 mx-auto text-[#1E3447]" />
                  <p className="text-[#94A3B8] mt-3 text-sm">No classes found.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {catalog.map((occ) => (
                    <button
                      key={occ.assignmentId}
                      onClick={() => setSelected(occ)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#1E3447] bg-[#0A111A] hover:border-[#00C8FF]/30 transition text-left"
                    >
                      {!isProfessor && (
                        <Avatar src={occ.assignment.professor_avatar} name={occ.primaryMeta.replace(/^Prof\.\s*/, '')} size="sm" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#F1F5F9] truncate">{occ.subject}</p>
                        <p className="text-xs text-[#94A3B8] truncate mt-0.5">
                          {occ.primaryMeta}
                          {occ.secondaryMeta ? ` • ${occ.secondaryMeta}` : ''}
                        </p>
                      </div>
                      <p className="text-xs text-[#64748B] flex-shrink-0 text-right">
                        {occ.assignment.schedule_days.join(', ')}
                        <br />
                        {formatTimeRange(occ.scheduleStart, occ.scheduleEnd)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Class Details modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-[#F1F5F9] truncate">{selected.subject}</h3>
                <span className={`inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 border ${STATUS_STYLES[selected.status]}`}>
                  {selected.status === 'now' ? 'NOW' : selected.status === 'next' ? 'NEXT' : selected.status === 'completed' ? 'COMPLETED' : selected.statusLabel}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-full transition flex-shrink-0">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {!isProfessor && (
                <div className="flex items-center gap-3">
                  <Avatar src={selected.assignment.professor_avatar} name={selected.primaryMeta.replace(/^Prof\.\s*/, '')} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#F1F5F9] truncate">{selected.primaryMeta}</p>
                    <p className="text-xs text-[#64748B]">Professor</p>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Section</span>
                  <span className="text-[#F1F5F9] font-medium">
                    {isProfessor ? selected.primaryMeta : selected.secondaryMeta || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Schedule</span>
                  <span className="text-[#F1F5F9] font-medium text-right">
                    {selected.assignment.schedule_days.join(', ')}
                    <br />
                    {formatTimeRange(selected.scheduleStart, selected.scheduleEnd)}
                  </span>
                </div>
                {isProfessor && selected.secondaryMeta && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Students</span>
                    <span className="text-[#F1F5F9] font-medium">{selected.secondaryMeta}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-1">
                {isProfessor && onOpenSection && (
                  <button
                    onClick={() => {
                      onOpenSection(selected.assignment.section_id);
                      setSelected(null);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition"
                  >
                    <Cog6ToothIcon className="h-4 w-4" />
                    Open Section
                  </button>
                )}
                {!isProfessor && selected.assignment.professor_id && selected.assignment.professor_id !== user?.id && (
                  <button
                    onClick={() => handleMessageProfessor(selected.assignment.professor_id)}
                    disabled={messaging}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-50"
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
                    className="w-full py-2.5 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition"
                  >
                    View Professor Profile
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
