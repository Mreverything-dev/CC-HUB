// frontend/src/features/sections/components/ProfessorTeachingHub.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenIcon,
  PlusIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  TrashIcon,
  AcademicCapIcon,
  ClockIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';
import { useSections } from '../hooks/useSections';
import { useTeachingAssignments } from '../hooks/useTeachingAssignments';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Section, SectionMember, TeachingAssignment, TeachingAssignmentAttendanceEntry } from '@/types/section.types';
import { teachingAssignmentApi } from '@/services/api/teaching_assignment.service';
import JoinSectionModal from './JoinSectionModal';
import AddSubjectModal from './AddSubjectModal';
import CreateSectionModal from './CreateSectionModal';
import EditSectionModal from './EditSectionModal';
import EditTeachingAssignmentModal from './EditTeachingAssignmentModal';
import StudentRecordModal, { StudentRecordTarget } from './StudentRecordModal';

interface ProfessorTeachingHubProps {
  onManageSection: (sectionId: string) => void;
}

interface SectionGroup {
  sectionId: string;
  sectionName: string;
  yearLevel: number | null;
  memberCount: number;
  subjects: TeachingAssignment[];
}

interface SearchResult {
  member: SectionMember;
  section: Section;
}

function memberRoleLabel(member: SectionMember): 'Mayor' | 'Officer' | 'Student' {
  if (member.is_mayor) return 'Mayor';
  if (member.is_officer) return 'Officer';
  return 'Student';
}

function memberFullName(member: SectionMember): string {
  if (member.user_first_name) return `${member.user_first_name} ${member.user_last_name || ''}`.trim();
  return member.user_username || 'Student';
}

function subjectHours(ta: TeachingAssignment): number {
  if (!ta.schedule_start || !ta.schedule_end) return 0;
  const [sh, sm] = ta.schedule_start.split(':').map(Number);
  const [eh, em] = ta.schedule_end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const diffMinutes = eh * 60 + em - (sh * 60 + sm);
  return diffMinutes > 0 ? Math.round((diffMinutes / 60) * 10) / 10 : 0;
}

function sumHours(subjects: TeachingAssignment[]): number {
  return Math.round(subjects.reduce((sum, ta) => sum + subjectHours(ta), 0) * 10) / 10;
}

// Cosmetic-only rotation for subject icon badges
const SUBJECT_ACCENTS = [
  { bg: 'bg-text-primary/10', text: 'text-text-primary', ring: 'border-border' },
  { bg: 'bg-[#8B5CF6]/12', text: 'text-[#8B5CF6]', ring: 'border-[#8B5CF6]/25' },
  { bg: 'bg-[#22C55E]/12', text: 'text-[#22C55E]', ring: 'border-[#22C55E]/25' },
  { bg: 'bg-[#F59E0B]/12', text: 'text-[#F59E0B]', ring: 'border-[#F59E0B]/25' },
];

function StatChip({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-glass backdrop-blur-xl px-4 py-3">
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${accent}1A`, color: accent }}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-text-primary leading-tight">{value}</p>
        <p className="text-xs text-text-secondary truncate">{label}</p>
      </div>
    </div>
  );
}

export default function ProfessorTeachingHub({ onManageSection }: ProfessorTeachingHubProps) {
  const { sections, isLoading: sectionsLoading, deleteSection } = useSections();
  const { mine, isLoading: assignmentsLoading } = useTeachingAssignments();

  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [addSubjectFor, setAddSubjectFor] = useState<SectionGroup | null>(null);
  const [editTarget, setEditTarget] = useState<TeachingAssignment | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecordTarget | null>(null);
  const [selectedStudentAssignments, setSelectedStudentAssignments] = useState<TeachingAssignment[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<SectionGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [editSectionTarget, setEditSectionTarget] = useState<Section | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!openMenuFor) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-section-menu]')) {
        setOpenMenuFor(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuFor]);

  const groups = useMemo<SectionGroup[]>(() => {
    const map = new Map<string, SectionGroup>();
    for (const ta of mine) {
      if (!map.has(ta.section_id)) {
        const sectionMatch = sections.find((s) => s.id === ta.section_id);
        map.set(ta.section_id, {
          sectionId: ta.section_id,
          sectionName: ta.section_name || sectionMatch?.name || 'Section',
          yearLevel: sectionMatch?.year_level ?? null,
          memberCount: sectionMatch?.member_count || 0,
          subjects: [],
        });
      }
      map.get(ta.section_id)!.subjects.push(ta);
    }
    return Array.from(map.values());
  }, [mine, sections]);

  const [subjectSummaries, setSubjectSummaries] = useState<
    Record<string, { present: number; absent: number; total: number }>
  >({});

  useEffect(() => {
    if (mine.length === 0) return;
    let cancelled = false;
    Promise.all(
      mine.map((ta) =>
        teachingAssignmentApi
          .getAttendance(ta.id)
          .then((res) => ({ id: ta.id, data: res.data }))
          .catch(() => ({ id: ta.id, data: [] as TeachingAssignmentAttendanceEntry[] }))
      )
    ).then((results) => {
      if (cancelled) return;
      const summaries: Record<string, { present: number; absent: number; total: number }> = {};
      for (const { id, data } of results) {
        if (data.length === 0) continue;
        const bySession = new Map<string, typeof data>();
        for (const entry of data) {
          if (!bySession.has(entry.session_id)) bySession.set(entry.session_id, []);
          bySession.get(entry.session_id)!.push(entry);
        }
        let latestSessionId: string | null = null;
        let latestTime = '';
        for (const [sessionId, entries] of bySession) {
          const t = entries[0]?.started_at || '';
          if (!latestSessionId || t > latestTime) {
            latestSessionId = sessionId;
            latestTime = t;
          }
        }
        const latestEntries = latestSessionId ? bySession.get(latestSessionId)! : [];
        summaries[id] = {
          present: latestEntries.filter((e) => e.status === 'present' || e.status === 'late').length,
          absent: latestEntries.filter((e) => e.status === 'absent').length,
          total: latestEntries.length,
        };
      }
      setSubjectSummaries(summaries);
    });
    return () => {
      cancelled = true;
    };
  }, [mine]);

  const totalSubjects = useMemo(() => groups.reduce((sum, g) => sum + g.subjects.length, 0), [groups]);
  const totalStudents = useMemo(() => groups.reduce((sum, g) => sum + g.memberCount, 0), [groups]);
  const totalHours = useMemo(() => sumHours(groups.flatMap((g) => g.subjects)), [groups]);

  const searchPool = useMemo<SearchResult[]>(() => {
    const pool: SearchResult[] = [];
    for (const section of sections) {
      for (const member of section.members || []) {
        pool.push({ member, section });
      }
    }
    return pool;
  }, [sections]);

  const searchResults = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return searchPool.filter(({ member }) => {
      const fullName = memberFullName(member).toLowerCase();
      return (
        fullName.includes(q) ||
        member.user_username?.toLowerCase().includes(q) ||
        member.user_email?.toLowerCase().includes(q)
      );
    });
  }, [searchPool, search]);

  const handleDeleteSection = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteSection(deleteTarget.sectionId);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const openStudentRecord = (member: SectionMember, section: Section) => {
    setSelectedStudent({
      userId: member.user_id,
      fullName: memberFullName(member),
      username: member.user_username,
      avatarUrl: member.user_avatar,
      sectionName: section.name,
      yearLevel: section.year_level,
      roleLabel: memberRoleLabel(member),
    });
    setSelectedStudentAssignments(mine.filter((ta) => ta.section_id === section.id));
  };

  const isLoading = sectionsLoading || assignmentsLoading;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-5 rounded-2xl border border-border bg-glass backdrop-blur-xl p-5 sm:p-6 flex items-center gap-4">
        <div className="flex h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-border bg-glass">
          <AcademicCapIcon className="h-5 w-5 sm:h-6 sm:w-6 text-text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary">My Teaching Assignments</h1>
          <p className="text-text-secondary mt-0.5 text-sm">Manage your sections, subjects, schedules, and students.</p>
        </div>
      </div>

      {/* Quick stats */}
      {!isLoading && groups.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatChip icon={UserGroupIcon} value={groups.length} label="Sections" accent="#00C8FF" />
          <StatChip icon={BookOpenIcon} value={totalSubjects} label="Subjects" accent="#8B5CF6" />
          <StatChip icon={AcademicCapIcon} value={totalStudents} label="Total Students" accent="#F59E0B" />
          <StatChip icon={ClockIcon} value={totalHours} label="Total Hours" accent="#22C55E" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
        {/* Main content - section grid */}
        <div className="min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-52 rounded-2xl bg-glass animate-pulse" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-2xl border border-border bg-glass backdrop-blur-xl py-16 px-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-glass">
                <BookOpenIcon className="h-7 w-7 text-text-primary" />
              </div>
              <p className="text-text-primary font-medium mt-4">You're not teaching any sections yet.</p>
              <p className="text-text-muted text-sm mt-1">Join a section you already advise, or start a new one below.</p>
              <button
                onClick={() => setShowJoin(true)}
                className="mt-5 px-5 py-2.5 text-sm font-semibold border border-border bg-glass text-text-primary rounded-xl hover:bg-glass-hover transition"
              >
                Join a Section
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {groups.map((group) => {
                const menuOpen = openMenuFor === group.sectionId;
                const sectionHours = sumHours(group.subjects);
                return (
                  <div
                    key={group.sectionId}
                    className="flex flex-col rounded-2xl border border-border bg-glass backdrop-blur-xl p-4 transition-all duration-200 hover:border-text-primary/30 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-text-primary truncate">{group.sectionName}</h3>
                          {group.yearLevel && (
                            <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-text-secondary bg-glass border border-border rounded-full px-2 py-0.5">
                              Year {group.yearLevel}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">
                          {group.subjects.length} {group.subjects.length === 1 ? 'Subject' : 'Subjects'}
                          {' • '}
                          {group.memberCount} {group.memberCount === 1 ? 'Student' : 'Students'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => onManageSection(group.sectionId)}
                          title="Manage Section"
                          className="p-2 text-text-primary bg-glass border border-border hover:bg-glass-hover rounded-xl transition"
                        >
                          <Cog6ToothIcon className="h-4 w-4" />
                        </button>
                        <div className="relative" data-section-menu>
                          <button
                            onClick={() => setOpenMenuFor(menuOpen ? null : group.sectionId)}
                            title="More options"
                            className={`p-2 rounded-xl border transition ${
                              menuOpen
                                ? 'text-text-primary bg-glass border-border'
                                : 'text-text-muted border-transparent hover:text-text-primary hover:bg-glass'
                            }`}
                          >
                            <EllipsisVerticalIcon className="h-4 w-4" />
                          </button>
                          {menuOpen && (
                            <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-border bg-bg shadow-xl z-20 overflow-hidden">
                              <button
                                onClick={() => {
                                  const full = sections.find((s) => s.id === group.sectionId);
                                  if (full) setEditSectionTarget(full);
                                  setOpenMenuFor(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-glass transition"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                                Edit Section Details
                              </button>
                              <button
                                onClick={() => {
                                  setAddSubjectFor(group);
                                  setOpenMenuFor(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-glass transition"
                              >
                                <PlusIcon className="h-4 w-4" />
                                Add Subject
                              </button>
                              <button
                                onClick={() => {
                                  if (group.subjects[0]) setEditTarget(group.subjects[0]);
                                  setOpenMenuFor(null);
                                }}
                                disabled={group.subjects.length === 0}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-glass transition disabled:opacity-40 disabled:pointer-events-none"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                                Edit Subjects
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteTarget(group);
                                  setOpenMenuFor(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[#EF4444] hover:bg-[#EF4444]/10 transition"
                              >
                                <TrashIcon className="h-4 w-4" />
                                Delete Section
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 flex-1">
                      {group.subjects.length === 0 ? (
                        <p className="text-xs text-text-muted text-center py-4">No subjects added yet.</p>
                      ) : (
                        group.subjects.map((ta, i) => {
                          const accent = SUBJECT_ACCENTS[i % SUBJECT_ACCENTS.length];
                          const hours = subjectHours(ta);
                          return (
                            <div
                              key={ta.id}
                              className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border bg-bg hover:border-text-primary/30 transition"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border ${accent.bg} ${accent.ring}`}
                                >
                                  <BookOpenIcon className={`h-4 w-4 ${accent.text}`} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-text-primary truncate">
                                    {ta.subject}
                                    {ta.subject_code && (
                                      <span className="ml-1.5 text-xs font-medium text-text-muted">({ta.subject_code})</span>
                                    )}
                                  </p>
                                  {ta.schedule_days.length > 0 ? (
                                    <p className="text-xs text-text-muted mt-0.5 truncate">
                                      {ta.schedule_days.join(', ')} • {ta.schedule_start?.slice(0, 5)}–{ta.schedule_end?.slice(0, 5)}
                                      {ta.room ? ` • ${ta.room}` : ''}
                                    </p>
                                  ) : (
                                    ta.status === 'inactive' && (
                                      <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted bg-glass border border-border rounded-full px-2 py-0.5">
                                        Inactive
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {subjectSummaries[ta.id] && subjectSummaries[ta.id].total > 0 && (
                                  <span
                                    className="hidden sm:inline text-[10px] font-medium text-text-secondary bg-glass border border-border rounded-full px-2 py-0.5"
                                    title="Present / Total in the most recent session"
                                  >
                                    {subjectSummaries[ta.id].present}/{subjectSummaries[ta.id].total} present
                                  </span>
                                )}
                                {hours > 0 && (
                                  <span className="hidden sm:inline text-[10px] font-medium text-text-secondary bg-glass border border-border rounded-full px-2 py-0.5">
                                    {hours}h
                                  </span>
                                )}
                                <button
                                  onClick={() => setEditTarget(ta)}
                                  title="Edit Subject"
                                  className="p-1.5 text-text-muted hover:text-text-primary hover:bg-glass rounded-lg transition"
                                >
                                  <PencilSquareIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <button
                      onClick={() => setAddSubjectFor(group)}
                      className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-text-primary hover:bg-glass rounded-xl transition"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add Subject
                    </button>

                    {(group.memberCount > 0 || sectionHours > 0) && (
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border text-[11px] text-text-muted">
                        <span className="flex items-center gap-1">
                          <AcademicCapIcon className="h-3.5 w-3.5" />
                          {group.memberCount} {group.memberCount === 1 ? 'Student' : 'Students'}
                        </span>
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-3.5 w-3.5" />
                          {sectionHours} {sectionHours === 1 ? 'Hour' : 'Hours'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                onClick={() => setShowCreate(true)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-glass backdrop-blur-xl p-4 min-h-[13rem] text-center hover:border-text-primary/40 hover:bg-glass-hover transition-all duration-200"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-glass">
                  <PlusIcon className="h-6 w-6 text-text-primary" />
                </div>
                <p className="text-sm font-semibold text-text-primary">Create New Section</p>
                <p className="text-xs text-text-muted max-w-[16rem]">
                  Start a new section and add subjects for your students.
                </p>
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              onClick={() => setShowJoin(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold rounded-2xl border border-border bg-glass backdrop-blur-xl text-text-secondary hover:text-text-primary hover:border-text-primary/40 transition"
            >
              <PlusIcon className="h-4 w-4" />
              Join Another Section
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold rounded-2xl border border-border bg-glass text-text-primary hover:bg-glass-hover transition"
            >
              <PlusIcon className="h-4 w-4" />
              Create Section
            </button>
          </div>
        </div>

        {/* Sidebar - student directory */}
        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-2xl border border-border bg-glass backdrop-blur-xl p-4">
            <h3 className="font-semibold text-text-primary flex items-center gap-2 mb-3">
              <UserGroupIcon className="h-4 w-4 text-text-primary" />
              Student Directory
            </h3>

            <div className="relative">
              <MagnifyingGlassIcon className="h-4 w-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name, username, or email..."
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-border bg-bg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-border focus:border-border transition"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition"
                >
                  <XCircleIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-3 space-y-1.5 max-h-96 overflow-y-auto themed-scrollbar">
              {!search ? (
                <p className="text-xs text-text-muted text-center py-6">Type to search your students.</p>
              ) : sectionsLoading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-14 rounded-xl bg-glass animate-pulse" />
                  ))}
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-6">No students found.</p>
              ) : (
                searchResults.map(({ member, section }) => (
                  <button
                    key={`${section.id}-${member.id}`}
                    onClick={() => openStudentRecord(member, section)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-glass transition text-left"
                  >
                    <Avatar src={member.user_avatar} name={memberFullName(member)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">{memberFullName(member)}</p>
                      <p className="text-xs text-text-muted truncate">
                        {memberRoleLabel(member)} • {section.name}
                        {section.year_level ? ` • Year ${section.year_level}` : ''}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showJoin && <JoinSectionModal onClose={() => setShowJoin(false)} />}
      {showCreate && <CreateSectionModal onClose={() => setShowCreate(false)} />}
      {addSubjectFor && (
        <AddSubjectModal
          sectionId={addSubjectFor.sectionId}
          sectionName={addSubjectFor.sectionName}
          onClose={() => setAddSubjectFor(null)}
        />
      )}
      {editTarget && <EditTeachingAssignmentModal assignment={editTarget} onClose={() => setEditTarget(null)} />}
      {editSectionTarget && (
        <EditSectionModal section={editSectionTarget} onClose={() => setEditSectionTarget(null)} />
      )}
      {selectedStudent && (
        <StudentRecordModal
          student={selectedStudent}
          assignments={selectedStudentAssignments}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Section"
          message={
            <>
              Permanently delete <span className="font-semibold text-text-primary">{deleteTarget.sectionName}</span>?
              This removes the section for <span className="font-semibold text-text-primary">everyone</span> -
              all students, the Mayor and Officer, every professor's teaching assignments in it, and its
              group chat. This cannot be undone.
            </>
          }
          confirmLabel="Delete Section"
          danger
          isLoading={isDeleting}
          onConfirm={handleDeleteSection}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}