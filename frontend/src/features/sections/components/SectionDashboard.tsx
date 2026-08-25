// frontend/src/features/sections/components/SectionDashboard.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  UserGroupIcon,
  AcademicCapIcon,
  CalendarIcon,
  UsersIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftIcon,
  PlusIcon,
  Cog6ToothIcon,
  MegaphoneIcon,
  SpeakerWaveIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSections } from '../hooks/useSections';
import { useChat } from '@/features/chat/hooks/useChat';
import { profileService } from '@/services/api/profile.service';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { Section, SectionMember, TeachingAssignment } from '@/types/section.types';
import AddStudentModal from './AddStudentModal';
import CreateSectionModal from './CreateSectionModal';
import SectionDetailModal from './SectionDetailModal';
import { TeachingAssignmentOnboardingBanner } from './TeachingAssignmentOnboardingBanner';
import { CreateAnnouncement } from '@/features/announcements/components/CreateAnnouncement';

interface SectionDashboardProps {
  /** Pre-select a section instead of defaulting to the first one - used when
   * entering from the professor's "My Teaching Assignments" hub via its
   * per-section "Manage" button. Omit for the default (student) behavior of
   * defaulting to the first section in the list. */
  initialSectionId?: string;
}

const STUDENTS_PAGE_SIZE = 10;

const inputClassName =
  'w-full px-3.5 py-2.5 rounded-xl border border-[#1E3447] bg-[#0A111A] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition';

// "HH:MM:SS" (the backend's Time column) -> "2:30 PM" - a schedule-string
// formatter, distinct from lib/formatters.ts's formatTime which formats a
// full Date/timestamp, not a bare time-of-day string.
function formatScheduleTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M5 18h14l1.5-9-5 3-3.5-6-3.5 6-5-3L5 18Zm0 2h14v2H5v-2Z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
    </svg>
  );
}

export default function SectionDashboard({ initialSectionId }: SectionDashboardProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { sections, isLoading, getSection, refetch, getSectionConversation } = useSections();
  const { createDirectConversation, openWidget, setCurrentConversation, refetchConversations } = useChat();

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(initialSectionId || null);
  const [showSectionSwitcher, setShowSectionSwitcher] = useState(false);
  const [section, setSection] = useState<Section | null>(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [openingChat, setOpeningChat] = useState(false);
  const [selectedProfessorId, setSelectedProfessorId] = useState<string | null>(null);
  const [showProfessorSwitcher, setShowProfessorSwitcher] = useState(false);
  const [search, setSearch] = useState('');
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);

  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showManageSection, setShowManageSection] = useState(false);
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);

  const [realFirstName, setRealFirstName] = useState('');
  const [realLastName, setRealLastName] = useState('');
  const [savingRealName, setSavingRealName] = useState(false);
  const [realNameError, setRealNameError] = useState<string | null>(null);

  const canCreateSection = user?.role === 'professor' || user?.role === 'admin';

  // Default to the first section once the list loads.
  useEffect(() => {
    if (!selectedSectionId && sections.length > 0) {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections, selectedSectionId]);

  // Fetch full member details for the selected section. Surfaces a real
  // error + retry instead of silently swallowing failures (e.g. a 403 from
  // the backend's view-access check, or a network error) - previously the
  // catch discarded the error entirely, so a failed fetch left the skeleton
  // loading state on screen forever with no way to tell what happened.
  const loadSection = useCallback((sectionId: string) => {
    setSectionLoading(true);
    setSectionError(null);
    getSection(sectionId)
      .then((data) => setSection(data))
      .catch((err) => {
        console.error('Failed to load section:', err);
        setSection(null);
        setSectionError(err?.response?.data?.detail || 'Failed to load this section. Please try again.');
      })
      .finally(() => setSectionLoading(false));
  }, [getSection]);

  useEffect(() => {
    if (!selectedSectionId) {
      setSection(null);
      setSectionError(null);
      return;
    }
    loadSection(selectedSectionId);
  }, [selectedSectionId]);

  const members = section?.members || [];
  const activeAssignments = (section?.teaching_assignments || []).filter((ta) => ta.status === 'active');
  // Group by professor - a professor can teach multiple subjects in the
  // same section, and must appear as exactly one card, not one per subject.
  const professorGroups = useMemo(() => {
    const map = new Map<string, TeachingAssignment[]>();
    for (const ta of activeAssignments) {
      if (!map.has(ta.professor_id)) map.set(ta.professor_id, []);
      map.get(ta.professor_id)!.push(ta);
    }
    return Array.from(map.values());
  }, [activeAssignments]);

  // Only one professor is shown at a time (main card + "Professor Details"
  // sidebar, kept in sync) - defaults to the first one whenever the
  // available set changes (new section selected, or the current pick is no
  // longer in the list).
  useEffect(() => {
    if (professorGroups.length === 0) {
      if (selectedProfessorId !== null) setSelectedProfessorId(null);
      return;
    }
    const stillValid = professorGroups.some((g) => g[0]?.professor_id === selectedProfessorId);
    if (!stillValid) setSelectedProfessorId(professorGroups[0][0].professor_id);
  }, [professorGroups, selectedProfessorId]);

  const selectedProfessorAssignments =
    professorGroups.find((g) => g[0]?.professor_id === selectedProfessorId) || professorGroups[0] || null;
  const otherProfessorGroups = professorGroups.filter(
    (g) => g[0]?.professor_id !== selectedProfessorAssignments?.[0]?.professor_id
  );

  const mayor = members.find((m) => m.is_mayor) || null;
  const officer = members.find((m) => m.is_officer && !m.is_mayor) || null;
  const regularStudents = members.filter((m) => !m.is_mayor);
  // Total section membership (students + Mayor + Officer), not just the
  // students shown in the grid below - the Mayor has their own dedicated
  // card and is intentionally left out of that grid, but must still count.
  const totalStudentCount = section?.member_count ?? members.length;

  const isTeachingProfessor = activeAssignments.some((ta) => ta.professor_id === user?.id);

  const canManage =
    user?.role === 'admin' ||
    user?.id === section?.advisor_id ||
    isTeachingProfessor ||
    members.some((m) => m.user_id === user?.id && (m.is_mayor || m.is_officer));

  const canPostAnnouncement =
    user?.role === 'admin' ||
    user?.id === section?.advisor_id ||
    isTeachingProfessor ||
    members.some((m) => m.user_id === user?.id && (m.is_mayor || m.is_officer));

  // A student who was just added to a section by a professor/admin/mayor
  // starts out with no StudentProfile.first_name set at all - there's no
  // separate "pending invitation" concept in this system (add_member always
  // creates an already-active membership), so this reuses the already-
  // fetched member row (this IS the page students land on when they open
  // Sections - SectionDetailModal, which had this same gate, is only ever
  // opened via the professor/admin/mayor-only "Manage Section" button, so a
  // regular student never reached it) as the signal that they still need to
  // set their real name before browsing the section normally.
  const currentMember = members.find((m) => m.user_id === user?.id);
  const needsRealName = user?.role === 'student' && !!currentMember && !currentMember.user_first_name;

  const filteredStudents = useMemo(() => {
    let list = regularStudents;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => {
        const fullName = m.user_first_name
          ? `${m.user_first_name} ${m.user_last_name || ''}`.trim().toLowerCase()
          : '';
        return (
          fullName.includes(q) ||
          m.user_username?.toLowerCase().includes(q) ||
          m.user_email?.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [regularStudents, search]);

  const visibleStudents =
    showAllStudents || search.trim() ? filteredStudents : filteredStudents.slice(0, STUDENTS_PAGE_SIZE);

  const handleMessage = async (userId: string) => {
    if (userId === user?.id) return;
    setMessagingUserId(userId);
    try {
      await createDirectConversation(userId);
      openWidget();
    } finally {
      setMessagingUserId(null);
    }
  };

  const refreshSection = async () => {
    if (!selectedSectionId) return;
    const fresh = await getSection(selectedSectionId);
    setSection(fresh);
    refetch();
  };

  const handleSaveRealName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!realFirstName.trim() || !realLastName.trim()) {
      setRealNameError('Please enter both your first and last name.');
      return;
    }
    setRealNameError(null);
    setSavingRealName(true);
    try {
      await profileService.updateStudentProfile({
        first_name: realFirstName.trim(),
        last_name: realLastName.trim(),
      });
      // Nothing to separately "accept" - the student is already a member,
      // so refreshing the section (now with their real name populated) is
      // what reveals the normal section view below.
      await refreshSection();
      toast.success('Welcome! Your name has been saved.');
    } catch (err: any) {
      setRealNameError(err.response?.data?.detail || "Couldn't save your name. Please try again.");
    } finally {
      setSavingRealName(false);
    }
  };

  // Opens the section's own dedicated group conversation (never the generic
  // chat list) - reuses the existing chat widget/API, gets-or-lazily-creates
  // the group on the backend so this works even for sections created before
  // this feature existed.
  const handleOpenSectionChat = async () => {
    if (!section || openingChat) return;
    setOpeningChat(true);
    try {
      const conversation = await getSectionConversation(section.id);
      setCurrentConversation(conversation);
      openWidget();
      refetchConversations();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Couldn't open the section chat. Please try again.");
    } finally {
      setOpeningChat(false);
    }
  };

  if (isLoading && sections.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="h-20 rounded-2xl bg-[#0D1722] animate-pulse" />
        <div className="h-32 rounded-2xl bg-[#0D1722] animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-40 rounded-2xl bg-[#0D1722] animate-pulse" />
          <div className="h-40 rounded-2xl bg-[#0D1722] animate-pulse" />
        </div>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Section</h1>
        <p className="text-[#94A3B8] mt-1 text-sm">Manage and connect with your class community.</p>
        <div className="mt-5">
          <TeachingAssignmentOnboardingBanner />
        </div>
        <div className="mt-6 rounded-2xl border border-[#1E3447] bg-[#0D1722] py-16 text-center">
          <UserGroupIcon className="h-12 w-12 mx-auto text-[#1E3447]" />
          <p className="text-[#94A3B8] mt-3">
            {canCreateSection ? 'No sections yet.' : 'You are not enrolled in any sections yet.'}
          </p>
          {canCreateSection && (
            <button
              onClick={() => setShowCreateSection(true)}
              className="mt-4 px-4 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition"
            >
              Create your first section
            </button>
          )}
        </div>
        {showCreateSection && <CreateSectionModal onClose={() => setShowCreateSection(false)} />}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#F1F5F9]">Section</h1>
          <p className="text-[#94A3B8] mt-1 text-sm">Manage and connect with your class community.</p>
        </div>

        <div className="relative w-full sm:w-72 flex-shrink-0">
          <button
            onClick={() => setShowSectionSwitcher((v) => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-[#1E3447] bg-[#0D1722] hover:border-[#00C8FF]/40 transition text-left"
          >
            <div className="h-9 w-9 rounded-xl bg-[#00C8FF]/10 border border-[#00C8FF]/25 flex items-center justify-center flex-shrink-0">
              <UserGroupIcon className="h-5 w-5 text-[#00C8FF]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#F1F5F9] truncate">{section?.name}</p>
              <p className="text-xs text-[#64748B] truncate">
                {section?.course} • Year {section?.year_level} • {section?.academic_year}
              </p>
            </div>
            {sections.length > 1 && (
              <ChevronDownIcon className={`h-4 w-4 text-[#64748B] flex-shrink-0 transition-transform ${showSectionSwitcher ? 'rotate-180' : ''}`} />
            )}
          </button>

          {showSectionSwitcher && sections.length > 1 && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSectionSwitcher(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-full rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl z-20 overflow-hidden max-h-64 overflow-y-auto themed-scrollbar">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSectionId(s.id);
                      setShowSectionSwitcher(false);
                      setShowAllStudents(false);
                      setSearch('');
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition ${
                      s.id === selectedSectionId ? 'text-[#00C8FF] bg-[#00C8FF]/10' : 'text-[#F1F5F9] hover:bg-white/5'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
                {canCreateSection && (
                  <button
                    onClick={() => {
                      setShowSectionSwitcher(false);
                      setShowCreateSection(true);
                    }}
                    className="w-full flex items-center gap-1.5 text-left px-4 py-2.5 text-sm text-[#94A3B8] hover:text-[#00C8FF] hover:bg-white/5 transition border-t border-[#1E3447]"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    New Section
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <TeachingAssignmentOnboardingBanner />

      {sectionError ? (
        <div className="rounded-2xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-6 flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-[#F1F5F9]">{sectionError}</p>
            <button
              onClick={() => selectedSectionId && loadSection(selectedSectionId)}
              className="text-xs font-medium text-[#EF4444] hover:underline mt-1.5"
            >
              Retry
            </button>
          </div>
        </div>
      ) : sectionLoading || !section ? (
        <div className="space-y-4">
          <div className="h-32 rounded-2xl bg-[#0D1722] animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-40 rounded-2xl bg-[#0D1722] animate-pulse" />
            <div className="h-40 rounded-2xl bg-[#0D1722] animate-pulse" />
          </div>
        </div>
      ) : needsRealName ? (
        /* First time a newly-added student opens this section - blocks the
           normal view until they set their real name (via the existing
           profile API). There's no separate "accept invitation" step to
           perform since add_member already made them a full member -
           saving the name and refreshing is what reveals the section. */
        <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-6 sm:p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00C8FF]/25 bg-[#00C8FF]/10">
            <SparklesIcon className="h-7 w-7 text-[#00C8FF]" />
          </div>
          <h3 className="text-lg font-bold text-[#F1F5F9] mt-4">You're in {section.name}!</h3>
          <p className="text-sm text-[#94A3B8] mt-1">What's your real name?</p>
          <form onSubmit={handleSaveRealName} className="mt-5 max-w-sm mx-auto text-left space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">First Name</label>
              <input
                type="text"
                value={realFirstName}
                onChange={(e) => setRealFirstName(e.target.value)}
                placeholder="e.g. Limwel"
                className={inputClassName}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Last Name</label>
              <input
                type="text"
                value={realLastName}
                onChange={(e) => setRealLastName(e.target.value)}
                placeholder="e.g. Perciba"
                className={inputClassName}
              />
            </div>
            {realNameError && <p className="text-xs text-[#EF4444]">{realNameError}</p>}
            <button
              type="submit"
              disabled={savingRealName}
              className="w-full py-2.5 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-50"
            >
              {savingRealName ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Main content */}
          <div className="xl:col-span-2 space-y-5 min-w-0">
            {/* Professor */}
            <div className="rounded-2xl border border-[#00C8FF]/20 bg-[#0D1722] shadow-[0_0_30px_rgba(0,200,255,0.05)] p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3">
                <AcademicCapIcon className="h-4 w-4" />
                Professor
              </div>
              {selectedProfessorAssignments ? (
                (() => {
                  const first = selectedProfessorAssignments[0];
                  const fullName = first.professor_first_name
                    ? `${first.professor_first_name} ${first.professor_last_name || ''}`.trim()
                    : first.professor_username || 'Professor';
                  const subjectLine = selectedProfessorAssignments.map((ta) => ta.subject).join(' • ');
                  return (
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <Avatar src={first.professor_avatar} name={fullName} size="lg" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-semibold text-[#F1F5F9] truncate">Prof. {fullName}</p>
                            <RoleBadge role="professor" />
                          </div>
                          <p className="text-sm text-[#94A3B8] mt-0.5 truncate">Subject: {subjectLine}</p>
                          {first.schedule_days.length > 0 && first.schedule_start && first.schedule_end && (
                            <p className="text-xs text-[#64748B] mt-0.5">
                              Schedule: {first.schedule_days.join(', ')} {formatScheduleTime(first.schedule_start)}-
                              {formatScheduleTime(first.schedule_end)}
                            </p>
                          )}
                        </div>
                        {first.professor_id !== user?.id && (
                          <button
                            onClick={() => handleMessage(first.professor_id)}
                            disabled={messagingUserId === first.professor_id}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold border border-[#00C8FF]/30 bg-[#00C8FF]/10 text-[#00C8FF] rounded-xl hover:bg-[#00C8FF]/20 transition disabled:opacity-50 flex-shrink-0"
                          >
                            <ChatBubbleLeftIcon className="h-4 w-4" />
                            Message
                          </button>
                        )}
                      </div>

                      {otherProfessorGroups.length > 0 && (
                        <div className="relative mt-4 pt-4 border-t border-[#1E3447]">
                          <button
                            onClick={() => setShowProfessorSwitcher((v) => !v)}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-[#00C8FF] hover:bg-white/5 rounded-xl transition"
                          >
                            <span>View other professors ({otherProfessorGroups.length})</span>
                            <ChevronDownIcon
                              className={`h-4 w-4 flex-shrink-0 transition-transform ${showProfessorSwitcher ? 'rotate-180' : ''}`}
                            />
                          </button>

                          {showProfessorSwitcher && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setShowProfessorSwitcher(false)} />
                              <div className="relative z-20 mt-1.5 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl overflow-hidden max-h-64 overflow-y-auto themed-scrollbar">
                                {otherProfessorGroups.map((group) => {
                                  const p = group[0];
                                  const name = p.professor_first_name
                                    ? `${p.professor_first_name} ${p.professor_last_name || ''}`.trim()
                                    : p.professor_username || 'Professor';
                                  return (
                                    <button
                                      key={p.professor_id}
                                      onClick={() => {
                                        setSelectedProfessorId(p.professor_id);
                                        setShowProfessorSwitcher(false);
                                      }}
                                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition"
                                    >
                                      <Avatar src={p.professor_avatar} name={name} size="sm" />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-[#F1F5F9] truncate">Prof. {name}</p>
                                        <p className="text-xs text-[#64748B] truncate">
                                          {group.map((ta) => ta.subject).join(' • ')}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <p className="text-sm text-[#64748B]">No professor assigned to this section.</p>
              )}
            </div>

            {/* Mayor / Officer cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Mayor */}
              <div className="rounded-2xl border border-[#F5B82E]/25 bg-[#0D1722] p-4">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#F5B82E] mb-3">
                  <CrownIcon className="h-4 w-4" />
                  Mayor
                </div>
                {mayor ? (
                  <div>
                    <div className="flex items-center gap-3">
                      <Avatar src={mayor.user_avatar} name={mayor.user_username || undefined} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#F1F5F9] truncate">{mayor.user_username}</p>
                        <span className="inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#F5B82E] bg-[#F5B82E]/10 border border-[#F5B82E]/30 rounded-full px-2 py-0.5">
                          Mayor
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-[#64748B] mt-2.5">{section.name}</p>
                    <p className="text-xs text-[#94A3B8] flex items-center gap-1 mt-0.5">
                      <ShieldIcon className="h-3 w-3 text-[#F5B82E]" />
                      Leading our section
                    </p>
                    {mayor.user_id !== user?.id && (
                      <button
                        onClick={() => handleMessage(mayor.user_id)}
                        disabled={messagingUserId === mayor.user_id}
                        className="w-full mt-3 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold border border-[#F5B82E]/30 bg-[#F5B82E]/10 text-[#F5B82E] rounded-xl hover:bg-[#F5B82E]/20 transition disabled:opacity-50"
                      >
                        <ChatBubbleLeftIcon className="h-4 w-4" />
                        Message
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[#64748B] py-3">No Mayor assigned</p>
                )}
              </div>

              {/* Officer */}
              <div className="rounded-2xl border border-[#3B9EFF]/25 bg-[#0D1722] p-4">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#3B9EFF] mb-3">
                  <ShieldIcon className="h-4 w-4" />
                  Officer
                </div>
                {officer ? (
                  <div>
                    <div className="flex items-center gap-3">
                      <Avatar src={officer.user_avatar} name={officer.user_username || undefined} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#F1F5F9] truncate">{officer.user_username}</p>
                        <span className="inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#3B9EFF] bg-[#3B9EFF]/10 border border-[#3B9EFF]/30 rounded-full px-2 py-0.5">
                          Officer
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-[#64748B] mt-2.5">{section.name}</p>
                    <p className="text-xs text-[#94A3B8] flex items-center gap-1 mt-0.5">
                      <ShieldIcon className="h-3 w-3 text-[#3B9EFF]" />
                      Assisting our section
                    </p>
                    {officer.user_id !== user?.id && (
                      <button
                        onClick={() => handleMessage(officer.user_id)}
                        disabled={messagingUserId === officer.user_id}
                        className="w-full mt-3 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold border border-[#3B9EFF]/30 bg-[#3B9EFF]/10 text-[#3B9EFF] rounded-xl hover:bg-[#3B9EFF]/20 transition disabled:opacity-50"
                      >
                        <ChatBubbleLeftIcon className="h-4 w-4" />
                        Message
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[#64748B] py-3">No Officer assigned</p>
                )}
              </div>
            </div>

            {/* Students */}
            <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <UsersIcon className="h-5 w-5 text-[#00C8FF]" />
                  <h3 className="font-semibold text-[#F1F5F9]">Students ({totalStudentCount})</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-56">
                    <MagnifyingGlassIcon className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search students..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#1E3447] bg-[#0A111A] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition"
                    />
                  </div>
                  {canManage && (
                    <button
                      onClick={() => setShowAddStudent(true)}
                      title="Add Student"
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border border-[#00C8FF]/30 bg-[#00C8FF]/10 text-[#00C8FF] hover:bg-[#00C8FF]/20 transition flex-shrink-0"
                    >
                      <PlusIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Add Student</span>
                    </button>
                  )}
                </div>
              </div>

              {regularStudents.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-[#1E3447] bg-[#0A111A]">
                  <p className="text-[#94A3B8]">No students in this section yet.</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-8">No students match your search.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {visibleStudents.map((member: SectionMember) => {
                      const fullName = member.user_first_name
                        ? `${member.user_first_name} ${member.user_last_name || ''}`.trim()
                        : member.user_username || 'Student';
                      return (
                        <div
                          key={member.id}
                          onClick={() => navigate(`/profile/${member.user_id}`)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate(`/profile/${member.user_id}`);
                            }
                          }}
                          className="rounded-xl border border-[#1E3447] bg-[#0A111A] hover:border-[#00C8FF]/30 transition p-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8FF]/60"
                        >
                          <div className="flex items-center gap-2.5">
                            <Avatar src={member.user_avatar} name={fullName} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[#F1F5F9] truncate">{fullName}</p>
                              <span className="text-[10px] font-medium text-[#94A3B8] bg-white/5 border border-[#1E3447] rounded-full px-1.5 py-0.5">
                                {member.is_officer ? 'Officer' : 'Student'}
                              </span>
                            </div>
                            {member.user_id !== user?.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMessage(member.user_id);
                                }}
                                disabled={messagingUserId === member.user_id}
                                title="Message"
                                className="p-1.5 text-[#64748B] hover:text-[#00C8FF] hover:bg-white/5 rounded-lg transition disabled:opacity-50 flex-shrink-0"
                              >
                                <ChatBubbleLeftIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-[#64748B] truncate mt-1.5">{member.user_email}</p>
                        </div>
                      );
                    })}
                  </div>

                  {!search.trim() && filteredStudents.length > STUDENTS_PAGE_SIZE && (
                    <button
                      onClick={() => setShowAllStudents((v) => !v)}
                      className="w-full mt-3 py-2 text-sm font-medium text-[#00C8FF] hover:bg-white/5 rounded-xl transition"
                    >
                      {showAllStudents ? 'Show Less' : `View All (${filteredStudents.length})`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            {/* About */}
            <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-4">
              <h3 className="font-semibold text-[#F1F5F9] mb-3">About This Section</h3>
              <dl className="space-y-2.5 text-sm">
                {[
                  { icon: UserGroupIcon, label: 'Section', value: section.name },
                  { icon: AcademicCapIcon, label: 'Program', value: section.course || '—' },
                  { icon: CalendarIcon, label: 'Year', value: section.year_level ? `Year ${section.year_level}` : '—' },
                  { icon: CalendarIcon, label: 'School Year', value: section.academic_year || '—' },
                  { icon: UsersIcon, label: 'Total Students', value: String(totalStudentCount) },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <Icon className="h-4 w-4 text-[#64748B] mt-0.5 flex-shrink-0" />
                    <div>
                      <dt className="text-[#64748B] text-xs">{label}</dt>
                      <dd className="text-[#F1F5F9]">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>

            {/* Professor Details - kept in sync with the professor selected
                in the main Professor card's dropdown above. */}
            <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-4">
              <h3 className="font-semibold text-[#F1F5F9]">Professor Details</h3>
              {!selectedProfessorAssignments ? (
                <p className="text-sm text-[#64748B] py-2 mt-1">No professor assigned yet.</p>
              ) : (
                (() => {
                  const first = selectedProfessorAssignments[0];
                  const fullName = first.professor_first_name
                    ? `${first.professor_first_name} ${first.professor_last_name || ''}`.trim()
                    : first.professor_username || 'Professor';
                  return (
                    <div className="mt-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar src={first.professor_avatar} name={fullName} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#F1F5F9] truncate">Prof. {fullName}</p>
                          <RoleBadge role="professor" className="mt-0.5" />
                        </div>
                      </div>

                      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mt-4 mb-2">
                        Subjects
                      </p>
                      <div className="space-y-2">
                        {selectedProfessorAssignments.map((ta) => (
                          <div key={ta.id} className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-2.5">
                            <p className="text-sm font-medium text-[#F1F5F9]">
                              {ta.subject}
                              {ta.subject_code && (
                                <span className="ml-1.5 text-xs font-normal text-[#64748B]">({ta.subject_code})</span>
                              )}
                            </p>
                            {ta.schedule_days.length > 0 && ta.schedule_start && ta.schedule_end ? (
                              <p className="text-xs text-[#94A3B8] mt-0.5">
                                {ta.schedule_days.join(', ')} &middot; {formatScheduleTime(ta.schedule_start)}-
                                {formatScheduleTime(ta.schedule_end)}
                                {ta.room ? ` · ${ta.room}` : ''}
                              </p>
                            ) : (
                              <p className="text-xs text-[#64748B] mt-0.5">Schedule not set</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {first.professor_id !== user?.id && (
                        <button
                          onClick={() => handleMessage(first.professor_id)}
                          disabled={messagingUserId === first.professor_id}
                          className="w-full mt-3 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold border border-[#00C8FF]/30 bg-[#00C8FF]/10 text-[#00C8FF] rounded-xl hover:bg-[#00C8FF]/20 transition disabled:opacity-50"
                        >
                          <ChatBubbleLeftIcon className="h-4 w-4" />
                          Message
                        </button>
                      )}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-4">
              <h3 className="font-semibold text-[#F1F5F9] mb-3">Quick Actions</h3>
              <div className="space-y-1">
                {canPostAnnouncement && (
                  <button
                    onClick={() => setShowCreateAnnouncement(true)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-[#F1F5F9] hover:bg-white/5 rounded-xl transition"
                  >
                    <span className="flex items-center gap-2">
                      <MegaphoneIcon className="h-4 w-4 text-[#00C8FF]" />
                      Create Announcement
                    </span>
                    <ChevronDownIcon className="h-3.5 w-3.5 text-[#64748B] -rotate-90" />
                  </button>
                )}
                <button
                  onClick={() => section && navigate(`/announcements?section=${section.id}`)}
                  disabled={!section}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-[#F1F5F9] hover:bg-white/5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <span className="flex items-center gap-2">
                    <SpeakerWaveIcon className="h-4 w-4 text-[#00C8FF]" />
                    View Announcements
                  </span>
                  <ChevronDownIcon className="h-3.5 w-3.5 text-[#64748B] -rotate-90" />
                </button>
                <button
                  onClick={handleOpenSectionChat}
                  disabled={!section || openingChat}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-[#F1F5F9] hover:bg-white/5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <span className="flex items-center gap-2">
                    <ChatBubbleLeftIcon className="h-4 w-4 text-[#00C8FF]" />
                    {openingChat ? 'Opening Section Chat...' : 'Section Chat'}
                  </span>
                  <ChevronDownIcon className="h-3.5 w-3.5 text-[#64748B] -rotate-90" />
                </button>
                {canManage && (
                  <button
                    onClick={() => setShowManageSection(true)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-[#F1F5F9] hover:bg-white/5 rounded-xl transition"
                  >
                    <span className="flex items-center gap-2">
                      <Cog6ToothIcon className="h-4 w-4 text-[#00C8FF]" />
                      Manage Section
                    </span>
                    <ChevronDownIcon className="h-3.5 w-3.5 text-[#64748B] -rotate-90" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddStudent && section && (
        <AddStudentModal
          sectionId={section.id}
          onClose={() => setShowAddStudent(false)}
          onSuccess={refreshSection}
        />
      )}

      {showManageSection && section && (
        <SectionDetailModal
          section={section}
          onClose={() => setShowManageSection(false)}
          onRefresh={refreshSection}
        />
      )}

      {showCreateSection && <CreateSectionModal onClose={() => setShowCreateSection(false)} />}

      {showCreateAnnouncement && section && (
        <CreateAnnouncement defaultSectionId={section.id} onClose={() => setShowCreateAnnouncement(false)} />
      )}
    </div>
  );
}
