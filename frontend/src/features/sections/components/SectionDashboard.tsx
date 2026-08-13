// frontend/src/features/sections/components/SectionDashboard.tsx
import { useEffect, useMemo, useState } from 'react';
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
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSections } from '../hooks/useSections';
import { useChat } from '@/features/chat/hooks/useChat';
import { profileService } from '@/services/api/profile.service';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { Section, SectionMember } from '@/types/section.types';
import { ProfessorProfile } from '@/types/profile.types';
import AddStudentModal from './AddStudentModal';
import CreateSectionModal from './CreateSectionModal';
import SectionDetailModal from './SectionDetailModal';
import { CreateAnnouncement } from '@/features/announcements/components/CreateAnnouncement';

interface SectionDashboardProps {
  onNavigateToAnnouncements: () => void;
  onNavigateToChat: () => void;
}

type StudentFilter = 'all' | 'officers' | 'students';

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

export default function SectionDashboard({ onNavigateToAnnouncements, onNavigateToChat }: SectionDashboardProps) {
  const { user } = useAuthStore();
  const { sections, isLoading, getSection, refetch } = useSections();
  const { createDirectConversation, openWidget } = useChat();

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [showSectionSwitcher, setShowSectionSwitcher] = useState(false);
  const [section, setSection] = useState<Section | null>(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [advisorProfile, setAdvisorProfile] = useState<ProfessorProfile | null>(null);
  const [search, setSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);

  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showManageSection, setShowManageSection] = useState(false);
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);

  const canCreateSection = user?.role === 'professor' || user?.role === 'admin';

  // Default to the first section once the list loads.
  useEffect(() => {
    if (!selectedSectionId && sections.length > 0) {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections, selectedSectionId]);

  // Fetch full member details for the selected section.
  useEffect(() => {
    if (!selectedSectionId) {
      setSection(null);
      return;
    }
    setSectionLoading(true);
    getSection(selectedSectionId)
      .then(setSection)
      .catch(() => setSection(null))
      .finally(() => setSectionLoading(false));
  }, [selectedSectionId]);

  // Enrich the advisor with real profile data (name/avatar/department) -
  // Section only stores advisor_id, so reuse the existing generic
  // GET /profiles/{userId} endpoint already used by ProfilePage.
  useEffect(() => {
    if (!section?.advisor_id) {
      setAdvisorProfile(null);
      return;
    }
    profileService
      .getUserProfile(section.advisor_id)
      .then((res) => setAdvisorProfile((res.data.profile as ProfessorProfile) || null))
      .catch(() => setAdvisorProfile(null));
  }, [section?.advisor_id]);

  const members = section?.members || [];
  const mayor = members.find((m) => m.is_mayor) || null;
  const officer = members.find((m) => m.is_officer && !m.is_mayor) || null;
  const regularStudents = members.filter((m) => !m.is_mayor);

  const canManage =
    user?.role === 'admin' ||
    user?.id === section?.advisor_id ||
    members.some((m) => m.user_id === user?.id && (m.is_mayor || m.is_officer));

  const canPostAnnouncement =
    user?.role === 'admin' ||
    user?.id === section?.advisor_id ||
    members.some((m) => m.user_id === user?.id && (m.is_mayor || m.is_officer));

  const filteredStudents = useMemo(() => {
    let list = regularStudents;
    if (studentFilter === 'officers') list = list.filter((m) => m.is_officer);
    if (studentFilter === 'students') list = list.filter((m) => !m.is_officer);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) => m.user_username?.toLowerCase().includes(q) || m.user_email?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [regularStudents, studentFilter, search]);

  const visibleStudents =
    showAllStudents || search.trim() || studentFilter !== 'all' ? filteredStudents : filteredStudents.slice(0, 8);

  const advisorName = advisorProfile?.first_name
    ? `${advisorProfile.first_name} ${advisorProfile.last_name || ''}`.trim()
    : null;

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
        <div>
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

      {sectionLoading || !section ? (
        <div className="space-y-4">
          <div className="h-32 rounded-2xl bg-[#0D1722] animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-40 rounded-2xl bg-[#0D1722] animate-pulse" />
            <div className="h-40 rounded-2xl bg-[#0D1722] animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Main content */}
          <div className="xl:col-span-2 space-y-5 min-w-0">
            {/* Professor card */}
            <div className="rounded-2xl border border-[#00C8FF]/20 bg-[#0D1722] shadow-[0_0_30px_rgba(0,200,255,0.05)] p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3">
                <AcademicCapIcon className="h-4 w-4" />
                Professor
              </div>
              {section.advisor_id ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <Avatar src={advisorProfile?.avatar_url} name={advisorName || 'Professor'} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-semibold text-[#F1F5F9] truncate">
                        {advisorName ? `Prof. ${advisorName}` : 'Professor'}
                      </p>
                      <RoleBadge role="professor" />
                    </div>
                    {advisorProfile?.department && (
                      <p className="text-sm text-[#94A3B8] mt-0.5">{advisorProfile.department}</p>
                    )}
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Teaching {section.name}
                      {section.course ? ` • ${section.course}` : ''}
                    </p>
                  </div>
                  {section.advisor_id !== user?.id && (
                    <button
                      onClick={() => handleMessage(section.advisor_id!)}
                      disabled={messagingUserId === section.advisor_id}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold border border-[#00C8FF]/30 bg-[#00C8FF]/10 text-[#00C8FF] rounded-xl hover:bg-[#00C8FF]/20 transition disabled:opacity-50 flex-shrink-0"
                    >
                      <ChatBubbleLeftIcon className="h-4 w-4" />
                      Message
                    </button>
                  )}
                </div>
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
                  <h3 className="font-semibold text-[#F1F5F9]">Students ({regularStudents.length})</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-52">
                    <MagnifyingGlassIcon className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search students..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#1E3447] bg-[#0A111A] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition"
                    />
                  </div>
                  <select
                    value={studentFilter}
                    onChange={(e) => setStudentFilter(e.target.value as StudentFilter)}
                    className="px-3 py-2 rounded-xl border border-[#1E3447] bg-[#0A111A] text-sm text-[#F1F5F9] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition"
                  >
                    <option value="all">All</option>
                    <option value="officers">Officers</option>
                    <option value="students">Students</option>
                  </select>
                  {canManage && (
                    <button
                      onClick={() => setShowAddStudent(true)}
                      title="Add Student"
                      className="p-2 rounded-xl border border-[#00C8FF]/30 bg-[#00C8FF]/10 text-[#00C8FF] hover:bg-[#00C8FF]/20 transition flex-shrink-0"
                    >
                      <PlusIcon className="h-4 w-4" />
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
                    {visibleStudents.map((member: SectionMember) => (
                      <div
                        key={member.id}
                        className="rounded-xl border border-[#1E3447] bg-[#0A111A] hover:border-[#00C8FF]/30 transition p-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar src={member.user_avatar} name={member.user_username || undefined} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#F1F5F9] truncate">{member.user_username}</p>
                            <span className="text-[10px] font-medium text-[#94A3B8] bg-white/5 border border-[#1E3447] rounded-full px-1.5 py-0.5">
                              {member.is_officer ? 'Officer' : 'Student'}
                            </span>
                          </div>
                          {member.user_id !== user?.id && (
                            <button
                              onClick={() => handleMessage(member.user_id)}
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
                    ))}
                  </div>

                  {!showAllStudents && !search.trim() && studentFilter === 'all' && filteredStudents.length > 8 && (
                    <button
                      onClick={() => setShowAllStudents(true)}
                      className="w-full mt-3 py-2 text-sm font-medium text-[#00C8FF] hover:bg-white/5 rounded-xl transition"
                    >
                      View all students
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
                  { icon: UsersIcon, label: 'Total Students', value: String(section.member_count ?? regularStudents.length) },
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

            {/* Class Officers */}
            <div className="rounded-2xl border border-[#1E3447] bg-[#0D1722] p-4">
              <h3 className="font-semibold text-[#F1F5F9]">Class Officers</h3>
              <p className="text-xs text-[#64748B] mt-0.5 mb-3">Your leaders are here to help.</p>
              {!mayor && !officer ? (
                <p className="text-sm text-[#64748B] py-2">No officers assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {mayor && (
                    <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/5 transition">
                      <Avatar src={mayor.user_avatar} name={mayor.user_username || undefined} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#F1F5F9] truncate">{mayor.user_username}</p>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#F5B82E] bg-[#F5B82E]/10 border border-[#F5B82E]/30 rounded-full px-1.5 py-0.5">
                          Mayor
                        </span>
                      </div>
                      {mayor.user_id !== user?.id && (
                        <button
                          onClick={() => handleMessage(mayor.user_id)}
                          className="p-1.5 text-[#64748B] hover:text-[#F5B82E] hover:bg-white/5 rounded-lg transition flex-shrink-0"
                        >
                          <ChatBubbleLeftIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                  {officer && (
                    <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/5 transition">
                      <Avatar src={officer.user_avatar} name={officer.user_username || undefined} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#F1F5F9] truncate">{officer.user_username}</p>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#3B9EFF] bg-[#3B9EFF]/10 border border-[#3B9EFF]/30 rounded-full px-1.5 py-0.5">
                          Officer
                        </span>
                      </div>
                      {officer.user_id !== user?.id && (
                        <button
                          onClick={() => handleMessage(officer.user_id)}
                          className="p-1.5 text-[#64748B] hover:text-[#3B9EFF] hover:bg-white/5 rounded-lg transition flex-shrink-0"
                        >
                          <ChatBubbleLeftIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
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
                  onClick={onNavigateToAnnouncements}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-[#F1F5F9] hover:bg-white/5 rounded-xl transition"
                >
                  <span className="flex items-center gap-2">
                    <SpeakerWaveIcon className="h-4 w-4 text-[#00C8FF]" />
                    View Announcements
                  </span>
                  <ChevronDownIcon className="h-3.5 w-3.5 text-[#64748B] -rotate-90" />
                </button>
                <button
                  onClick={onNavigateToChat}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-[#F1F5F9] hover:bg-white/5 rounded-xl transition"
                >
                  <span className="flex items-center gap-2">
                    <ChatBubbleLeftIcon className="h-4 w-4 text-[#00C8FF]" />
                    Section Chat
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
