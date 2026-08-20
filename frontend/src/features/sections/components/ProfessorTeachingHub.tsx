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
} from '@heroicons/react/24/outline';
import { useSections } from '../hooks/useSections';
import { useTeachingAssignments } from '../hooks/useTeachingAssignments';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Section, SectionMember, TeachingAssignment } from '@/types/section.types';
import JoinSectionModal from './JoinSectionModal';
import AddSubjectModal from './AddSubjectModal';
import CreateSectionModal from './CreateSectionModal';
import EditTeachingAssignmentModal from './EditTeachingAssignmentModal';
import StudentRecordModal, { StudentRecordTarget } from './StudentRecordModal';

interface ProfessorTeachingHubProps {
  /** Opens the existing SectionDashboard view for this section (roster,
   * mayor/officer, announcements/chat shortcuts). */
  onManageSection: (sectionId: string) => void;
}

interface SectionGroup {
  sectionId: string;
  sectionName: string;
  yearLevel: number | null;
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

/**
 * The professor's main "Sections" landing page - lists everything they
 * teach (grouped by section, subjects + schedule) plus a search across
 * students in those sections. Subjects are managed inline per section card;
 * joining/creating sections are the only section-level actions here.
 */
export default function ProfessorTeachingHub({ onManageSection }: ProfessorTeachingHubProps) {
  const { sections, isLoading: sectionsLoading, deleteSection } = useSections();
  const { mine, isLoading: assignmentsLoading } = useTeachingAssignments();

  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [addSubjectFor, setAddSubjectFor] = useState<SectionGroup | null>(null);
  const [editTarget, setEditTarget] = useState<TeachingAssignment | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecordTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SectionGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const groups = useMemo<SectionGroup[]>(() => {
    const map = new Map<string, SectionGroup>();
    for (const ta of mine) {
      if (!map.has(ta.section_id)) {
        const sectionMatch = sections.find((s) => s.id === ta.section_id);
        map.set(ta.section_id, {
          sectionId: ta.section_id,
          sectionName: ta.section_name || sectionMatch?.name || 'Section',
          yearLevel: sectionMatch?.year_level ?? null,
          subjects: [],
        });
      }
      map.get(ta.section_id)!.subjects.push(ta);
    }
    return Array.from(map.values());
  }, [mine, sections]);

  // Every student across the professor's own sections (already backend-scoped
  // via useSections()) - search is purely client-side over data already on
  // hand, so it can never reach a section this professor doesn't teach.
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
  };

  const isLoading = sectionsLoading || assignmentsLoading;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">My Teaching Assignments</h1>
        <p className="text-[#94A3B8] mt-1 text-sm">Manage the sections and subjects you teach.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Main content - sections & subjects */}
        <div className="xl:col-span-2 space-y-4 min-w-0">
          {isLoading ? (
            <div className="space-y-4">
              {[0, 1].map((i) => (
                <div key={i} className="h-40 rounded-2xl bg-[#0D1722] animate-pulse" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] py-16 text-center">
              <BookOpenIcon className="h-12 w-12 mx-auto text-[#1E3447]" />
              <p className="text-[#94A3B8] mt-3">You're not teaching any sections yet.</p>
              <button
                onClick={() => setShowJoin(true)}
                className="mt-4 px-4 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition"
              >
                Join a Section
              </button>
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.sectionId}
                className="rounded-2xl border border-[#00C8FF]/20 bg-[#0D1722] shadow-[0_0_30px_rgba(0,200,255,0.05)] p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#F1F5F9]">{group.sectionName}</h3>
                    {group.yearLevel && <p className="text-xs text-[#64748B] mt-0.5">Year {group.yearLevel}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => onManageSection(group.sectionId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold border border-[#00C8FF]/30 bg-[#00C8FF]/10 text-[#00C8FF] rounded-xl hover:bg-[#00C8FF]/20 transition"
                    >
                      <Cog6ToothIcon className="h-3.5 w-3.5" />
                      Manage
                    </button>
                    <button
                      onClick={() => setDeleteTarget(group)}
                      title="Delete Section"
                      className="p-2 text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-xl transition"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {group.subjects.map((ta) => (
                    <div
                      key={ta.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-xl border border-[#1E3447] bg-[#0A111A] hover:border-[#00C8FF]/30 transition"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#F1F5F9] truncate">{ta.subject}</p>
                        {ta.schedule_days.length > 0 && (
                          <p className="text-xs text-[#64748B] mt-0.5">
                            {ta.schedule_days.join(', ')} • {ta.schedule_start?.slice(0, 5)}–{ta.schedule_end?.slice(0, 5)}
                          </p>
                        )}
                        {ta.status === 'inactive' && (
                          <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#64748B] bg-white/5 border border-[#1E3447] rounded-full px-2 py-0.5">
                            Inactive
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setEditTarget(ta)}
                        title="Edit"
                        className="p-1.5 text-[#64748B] hover:text-[#00C8FF] hover:bg-white/5 rounded-lg transition flex-shrink-0"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setAddSubjectFor(group)}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-[#00C8FF] hover:bg-white/5 rounded-xl transition"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Subject
                </button>
              </div>
            ))
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowJoin(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold rounded-2xl border border-[#1E3447] bg-[rgba(15,28,40,0.75)] backdrop-blur-xl text-[#94A3B8] hover:text-[#00C8FF] hover:border-[#00C8FF]/40 transition"
            >
              <PlusIcon className="h-4 w-4" />
              Join Another Section
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold rounded-2xl bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] hover:opacity-90 transition"
            >
              <PlusIcon className="h-4 w-4" />
              Create Section
            </button>
          </div>
        </div>

        {/* Sidebar - student search */}
        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-4">
            <h3 className="font-semibold text-[#F1F5F9] flex items-center gap-2 mb-3">
              <UserGroupIcon className="h-4 w-4 text-[#00C8FF]" />
              Search Students
            </h3>

            <div className="relative">
              <MagnifyingGlassIcon className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search students..."
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#1E3447] bg-[#0A111A] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#F1F5F9] transition"
                >
                  <XCircleIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-3 space-y-1.5 max-h-96 overflow-y-auto themed-scrollbar">
              {!search ? (
                <p className="text-xs text-[#64748B] text-center py-6">Type to search your students.</p>
              ) : sectionsLoading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-14 rounded-xl bg-[#0A111A] animate-pulse" />
                  ))}
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-[#64748B] text-center py-6">No students found.</p>
              ) : (
                searchResults.map(({ member, section }) => (
                  <button
                    key={`${section.id}-${member.id}`}
                    onClick={() => openStudentRecord(member, section)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/5 transition text-left"
                  >
                    <Avatar src={member.user_avatar} name={memberFullName(member)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#F1F5F9] truncate">{memberFullName(member)}</p>
                      <p className="text-xs text-[#64748B] truncate">
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
      {selectedStudent && <StudentRecordModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Section"
          message={
            <>
              Permanently delete <span className="font-semibold text-[#F1F5F9]">{deleteTarget.sectionName}</span>?
              This removes the section for <span className="font-semibold text-[#F1F5F9]">everyone</span> -
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
