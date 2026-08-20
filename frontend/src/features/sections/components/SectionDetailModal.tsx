// frontend/src/features/sections/components/SectionDetailModal.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Section, SectionMember } from '@/types/section.types';
import { useSections } from '../hooks/useSections';
import { useAuthStore } from '@/features/auth/store/auth.store';
import {
  XMarkIcon,
  UserPlusIcon,
  UserMinusIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import AddStudentModal from '../components/AddStudentModal';
import { CreateAnnouncement } from '@/features/announcements/components/CreateAnnouncement';

interface SectionDetailModalProps {
  section: Section;
  onClose: () => void;
  onRefresh: () => void;
}

export default function SectionDetailModal({ section: initialSection, onClose, onRefresh }: SectionDetailModalProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const {
    promoteToOfficer,
    demoteOfficer,
    promoteToMayor,
    demoteMayor,
    removeMember,
    getSection,
  } = useSections();

  const [section, setSection] = useState<Section>(initialSection);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SectionMember | null>(null);

  // A user counts as "one of the section's professors" via the legacy
  // single advisor_id OR an active teaching assignment - never just one.
  const isTeachingProfessor = section.teaching_assignments?.some(
    (ta) => ta.professor_id === user?.id && ta.status === 'active'
  );

  // ✅ Check if user can manage this section
  const canManage = user?.role === 'admin' ||
                    user?.id === section.advisor_id ||
                    isTeachingProfessor ||
                    // ✅ Check if user is a member with officer/mayor role
                    section.members?.some(m =>
                      m.user_id === user?.id && (m.is_officer || m.is_mayor)
                    );

  // ✅ Check if user is a member
  const isMember = section.members?.some(m => m.user_id === user?.id);

  // ✅ Get user's role in the section
  const userMember = section.members?.find(m => m.user_id === user?.id);
  const isOfficer = userMember?.is_officer || false;
  const isMayor = userMember?.is_mayor || false;

  // Fetch full section details when modal opens
  useEffect(() => {
    const fetchSectionDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const fullSection = await getSection(initialSection.id);
        setSection(fullSection);
      } catch (err) {
        console.error('Failed to fetch section details:', err);
        setError('Failed to load section details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSectionDetails();
  }, [initialSection.id]);

  // Refresh section data after actions
  const refreshSection = async () => {
    try {
      const fullSection = await getSection(initialSection.id);
      setSection(fullSection);
      onRefresh();
    } catch (error) {
      console.error('Failed to refresh section:', error);
    }
  };

  // ✅ Gates the whole per-member action row (Mayor also gets to remove
  // students here); promoting/demoting Mayor or Officer specifically is
  // further restricted below to just the advisor/admin - a Mayor cannot
  // appoint or remove another Mayor/Officer.
  const canPromote = user?.role === 'admin' ||
                     user?.id === section.advisor_id ||
                     isTeachingProfessor ||
                     isMayor;

  const handlePromoteOfficer = async (userId: string) => {
    setActionLoading(true);
    try {
      await promoteToOfficer({ sectionId: section.id, userId });
      await refreshSection();
    } catch (error) {
      console.error('Failed to promote to officer:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDemoteOfficer = async (userId: string) => {
    setActionLoading(true);
    try {
      await demoteOfficer({ sectionId: section.id, userId });
      await refreshSection();
    } catch (error) {
      console.error('Failed to demote officer:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromoteMayor = async (userId: string) => {
    setActionLoading(true);
    try {
      await promoteToMayor({ sectionId: section.id, userId });
      await refreshSection();
    } catch (error) {
      console.error('Failed to promote to mayor:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDemoteMayor = async (userId: string) => {
    setActionLoading(true);
    try {
      await demoteMayor({ sectionId: section.id, userId });
      await refreshSection();
    } catch (error) {
      console.error('Failed to demote mayor:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setActionLoading(true);
    try {
      await removeMember({ sectionId: section.id, userId: removeTarget.user_id });
      await refreshSection();
      setRemoveTarget(null);
    } catch (error) {
      console.error('Failed to remove member:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const members = section.members || [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-[#111E2B]/95 backdrop-blur-xl border border-[#1E3447] shadow-[0_0_40px_rgba(0,200,255,0.06)] rounded-none sm:rounded-2xl max-w-4xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto themed-scrollbar">
        {/* Header */}
        <div className="sticky top-0 bg-[#111E2B]/95 backdrop-blur-xl border-b border-[#1E3447] p-4 sm:p-5 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-[#F1F5F9] truncate">{section.name}</h2>
            <p className="text-sm text-[#94A3B8] truncate">
              {section.course} • Year {section.year_level} • {section.academic_year}
            </p>
            {/* ✅ Show user's role in section */}
            {isMember && (
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                {isMayor && (
                  <span className="text-xs bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <ShieldCheckIcon className="h-3 w-3" />
                    Class Mayor
                  </span>
                )}
                {isOfficer && !isMayor && (
                  <span className="text-xs bg-[#00C8FF]/10 text-[#00C8FF] border border-[#00C8FF]/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <ShieldCheckIcon className="h-3 w-3" />
                    Officer
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-full transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        {section.description && (
          <div className="p-4 bg-[#0A111A] border-b border-[#1E3447]">
            <p className="text-sm text-[#94A3B8]">{section.description}</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="m-4 p-4 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-[#F1F5F9]">{error}</p>
              <button
                onClick={() => {
                  setSection(initialSection);
                  setError(null);
                  getSection(initialSection.id).then(setSection).catch(() => setError('Failed to load section details. Please try again.'));
                }}
                className="text-xs font-medium text-[#EF4444] hover:underline mt-1"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="p-4 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-[#162534]/60 animate-pulse" />
            ))}
          </div>
        ) : !error && (
          <>
            {/* Actions - Show for users with manage permission (advisor, admin, mayor, officer) */}
            {canManage && (
              <div className="p-4 border-b border-[#1E3447] flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowAddStudent(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition"
                >
                  <UserPlusIcon className="h-5 w-5" />
                  Add Student
                </button>
                <button
                  onClick={() => setShowCreateAnnouncement(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-[#00C8FF]/30 bg-[#00C8FF]/10 text-[#00C8FF] rounded-xl hover:bg-[#00C8FF]/20 transition"
                >
                  <MegaphoneIcon className="h-5 w-5" />
                  Create Announcement
                </button>
              </div>
            )}

            {/* Members List */}
            <div className="p-4">
              <h3 className="font-semibold text-[#F1F5F9] mb-3 flex items-center gap-2">
                <UserGroupIcon className="h-5 w-5 text-[#00C8FF]" />
                Students ({members.length})
              </h3>

              {members.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-[#1E3447] bg-[#0A111A]">
                  <p className="text-[#94A3B8]">No students in this section yet.</p>
                  {canManage && (
                    <button
                      onClick={() => setShowAddStudent(true)}
                      className="mt-3 text-sm text-[#00C8FF] hover:underline font-medium"
                    >
                      Add your first student
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => {
                    // ✅ Check if current user can manage this specific member
                    const canManageMember = canManage && member.user_id !== user?.id;

                    return (
                      <div
                        key={member.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-[#162534]/60 hover:bg-[#162534] border border-transparent hover:border-[#1E3447] rounded-xl transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar src={member.user_avatar} name={member.user_username || undefined} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p
                                onClick={() => navigate(`/profile/${member.user_id}`)}
                                className="font-medium text-[#F1F5F9] hover:underline cursor-pointer truncate"
                              >
                                {member.user_username}
                              </p>
                              {member.is_mayor && (
                                <span className="text-xs bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                                  Mayor
                                </span>
                              )}
                              {member.is_officer && !member.is_mayor && (
                                <span className="text-xs bg-[#00C8FF]/10 text-[#00C8FF] border border-[#00C8FF]/30 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                                  Officer
                                </span>
                              )}
                              {!member.is_mayor && !member.is_officer && (
                                <span className="text-xs bg-white/5 text-[#94A3B8] border border-[#1E3447] px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                                  Student
                                </span>
                              )}
                              {member.user_id === user?.id && (
                                <span className="text-xs bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/30 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-[#64748B] truncate">{member.user_email}</p>
                          </div>
                        </div>

                        {/* Actions - Show for users with promote permission (Mayor/Advisor/Admin) */}
                        {canPromote && canManageMember && (
                          <div className="flex items-center gap-2 flex-wrap sm:flex-shrink-0 sm:justify-end">
                            {/* Mayor Actions - Only a section professor/Admin can manage Mayor */}
                            {(user?.role === 'admin' || user?.id === section.advisor_id || isTeachingProfessor) && (
                              <>
                                {member.is_mayor ? (
                                  <button
                                    onClick={() => handleDemoteMayor(member.user_id)}
                                    disabled={actionLoading}
                                    className="px-3 py-1.5 text-xs font-medium bg-[#EF4444]/10 text-[#EF4444] rounded-lg hover:bg-[#EF4444]/20 transition disabled:opacity-50"
                                  >
                                    Demote Mayor
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handlePromoteMayor(member.user_id)}
                                    disabled={actionLoading}
                                    className="px-3 py-1.5 text-xs font-medium bg-[#F59E0B]/10 text-[#F59E0B] rounded-lg hover:bg-[#F59E0B]/20 transition disabled:opacity-50"
                                  >
                                    Make Mayor
                                  </button>
                                )}
                              </>
                            )}

                            {/* Officer Actions - Only a section professor/Admin can manage Officer (Mayor cannot) */}
                            {(user?.role === 'admin' || user?.id === section.advisor_id || isTeachingProfessor) && !member.is_mayor && (
                              <>
                                {member.is_officer ? (
                                  <button
                                    onClick={() => handleDemoteOfficer(member.user_id)}
                                    disabled={actionLoading}
                                    className="px-3 py-1.5 text-xs font-medium bg-[#EF4444]/10 text-[#EF4444] rounded-lg hover:bg-[#EF4444]/20 transition disabled:opacity-50"
                                  >
                                    Demote Officer
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handlePromoteOfficer(member.user_id)}
                                    disabled={actionLoading}
                                    className="px-3 py-1.5 text-xs font-medium bg-[#00C8FF]/10 text-[#00C8FF] rounded-lg hover:bg-[#00C8FF]/20 transition disabled:opacity-50"
                                  >
                                    Make Officer
                                  </button>
                                )}
                              </>
                            )}

                            {/* Remove - Mayor/Advisor/Admin can remove members */}
                            <button
                              onClick={() => setRemoveTarget(member)}
                              disabled={actionLoading}
                              title="Remove from section"
                              className="p-1.5 text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition disabled:opacity-50"
                            >
                              <UserMinusIcon className="h-[18px] w-[18px]" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddStudent && (
        <AddStudentModal
          sectionId={section.id}
          onClose={() => setShowAddStudent(false)}
          onSuccess={refreshSection}
        />
      )}

      {/* Create Announcement Modal - pre-scoped to this section */}
      {showCreateAnnouncement && (
        <CreateAnnouncement
          defaultSectionId={section.id}
          onClose={() => setShowCreateAnnouncement(false)}
        />
      )}

      {/* Remove member confirmation */}
      {removeTarget && (
        <ConfirmDialog
          title="Remove Student"
          message={
            <>
              Remove <span className="font-semibold text-[#F1F5F9]">{removeTarget.user_username}</span>{' '}
              from <span className="font-semibold text-[#F1F5F9]">"{section.name}"</span>? They will
              lose access to this section's announcements and resources.
            </>
          }
          confirmLabel="Remove"
          isLoading={actionLoading}
          onConfirm={handleRemoveMember}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}
