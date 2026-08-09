// frontend/src/features/sections/components/SectionDetailModal.tsx
import { useState, useEffect } from 'react';
import { Section } from '@/types/section.types';
import { useSections } from '../hooks/useSections';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { XMarkIcon, UserPlusIcon, UserMinusIcon, UserGroupIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import AddStudentModal from '../components/AddStudentModal';

interface SectionDetailModalProps {
  section: Section;
  onClose: () => void;
  onRefresh: () => void;
}

export default function SectionDetailModal({ section: initialSection, onClose, onRefresh }: SectionDetailModalProps) {
  const { user } = useAuthStore();
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
  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ Check if user can manage this section
  const canManage = user?.role === 'admin' || 
                    user?.id === section.advisor_id ||
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
      try {
        const fullSection = await getSection(initialSection.id);
        setSection(fullSection);
      } catch (error) {
        console.error('Failed to fetch section details:', error);
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

  // ✅ Check if user can promote/demote (only mayor, professor, admin can promote/demote)
  const canPromote = user?.role === 'admin' || 
                     user?.id === section.advisor_id || 
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

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this student from the section?')) return;
    setActionLoading(true);
    try {
      await removeMember({ sectionId: section.id, userId });
      await refreshSection();
    } catch (error) {
      console.error('Failed to remove member:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const members = section.members || [];

  // ✅ Debug: Log permissions
  console.log('🔍 SectionDetailModal - canManage:', canManage);
  console.log('🔍 SectionDetailModal - canPromote:', canPromote);
  console.log('🔍 SectionDetailModal - user role:', user?.role);
  console.log('🔍 SectionDetailModal - isOfficer:', isOfficer);
  console.log('🔍 SectionDetailModal - isMayor:', isMayor);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{section.name}</h2>
            <p className="text-sm text-gray-600">
              {section.course} • Year {section.year_level} • {section.academic_year}
            </p>
            {/* ✅ Show user's role in section */}
            {isMember && (
              <div className="mt-1 flex items-center gap-2">
                {isMayor && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <ShieldCheckIcon className="h-3 w-3" />
                    Class Mayor
                  </span>
                )}
                {isOfficer && !isMayor && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <ShieldCheckIcon className="h-3 w-3" />
                    Officer
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Description */}
        {section.description && (
          <div className="p-4 bg-gray-50 border-b">
            <p className="text-sm text-gray-600">{section.description}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Actions - Show for users with manage permission */}
            {canManage && (
              <div className="p-4 border-b flex items-center gap-2">
                <button
                  onClick={() => setShowAddStudent(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <UserPlusIcon className="h-5 w-5" />
                  Add Student
                </button>
              </div>
            )}

            {/* Members List */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <UserGroupIcon className="h-5 w-5" />
                Students ({members.length})
              </h3>

              {members.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No students in this section yet.</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => {
                    // ✅ Check if current user can manage this specific member
                    const canManageMember = canManage && member.user_id !== user?.id;
                    
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {member.user_username}
                              {member.is_mayor && (
                                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
                                  Mayor
                                </span>
                              )}
                              {member.is_officer && !member.is_mayor && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                                  Officer
                                </span>
                              )}
                              {member.user_id === user?.id && (
                                <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-gray-500">{member.user_email}</p>
                          </div>
                        </div>

                        {/* Actions - Show for users with promote permission (Mayor/Advisor/Admin) */}
                        {canPromote && canManageMember && (
                          <div className="flex items-center gap-2">
                            {/* Mayor Actions - Only Advisor/Admin can manage Mayor */}
                            {(user?.role === 'admin' || user?.id === section.advisor_id) && (
                              <>
                                {member.is_mayor ? (
                                  <button
                                    onClick={() => handleDemoteMayor(member.user_id)}
                                    disabled={actionLoading}
                                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition disabled:opacity-50"
                                  >
                                    Demote Mayor
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handlePromoteMayor(member.user_id)}
                                    disabled={actionLoading}
                                    className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition disabled:opacity-50"
                                  >
                                    Make Mayor
                                  </button>
                                )}
                              </>
                            )}

                            {/* Officer Actions - Mayor/Advisor/Admin can manage officers */}
                            {member.is_officer && !member.is_mayor ? (
                              <button
                                onClick={() => handleDemoteOfficer(member.user_id)}
                                disabled={actionLoading}
                                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition disabled:opacity-50"
                              >
                                Demote Officer
                              </button>
                            ) : !member.is_mayor && (
                              <button
                                onClick={() => handlePromoteOfficer(member.user_id)}
                                disabled={actionLoading}
                                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition disabled:opacity-50"
                              >
                                Make Officer
                              </button>
                            )}

                            {/* Remove - Mayor/Advisor/Admin can remove members */}
                            <button
                              onClick={() => handleRemoveMember(member.user_id)}
                              disabled={actionLoading}
                              className="p-1 text-gray-400 hover:text-red-600 transition disabled:opacity-50"
                            >
                              <UserMinusIcon className="h-5 w-5" />
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
    </div>
  );
}