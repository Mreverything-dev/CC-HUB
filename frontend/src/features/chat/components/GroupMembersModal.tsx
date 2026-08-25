// frontend/src/features/chat/components/GroupMembersModal.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon, UsersIcon } from '@heroicons/react/24/outline';
import { chatApi } from '@/services/api/chat.service';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { GroupMember } from '@/types/chat.types';
import toast from 'react-hot-toast';

interface GroupMembersModalProps {
  conversationId: string;
  onClose: () => void;
}

/** Mayor/Officer are section-specific designations layered on top of the
 * base "student" role - shown as an extra chip. Professor/Admin/Student
 * already render correctly via the shared RoleBadge, so no extra chip is
 * needed for them. */
function extraTag(m: GroupMember): { label: string; className: string } | null {
  if (m.is_mayor) return { label: 'Mayor', className: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30' };
  if (m.is_officer) return { label: 'Officer', className: 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30' };
  return null;
}

/**
 * Members panel for a group (section or subject) chat - reuses the existing
 * profile-role/avatar data via the chat API's own group-members endpoint
 * (which itself reads the same SectionMember/TeachingAssignment rows that
 * already govern real conversation membership), not a separate roster.
 */
export function GroupMembersModal({ conversationId, onClose }: GroupMembersModalProps) {
  const navigate = useNavigate();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    chatApi
      .getGroupMembers(conversationId)
      .then((res) => {
        if (!cancelled) setMembers(res.data);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load members');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0D1722] w-full sm:max-w-md sm:rounded-2xl border border-[#1E3447] shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#1E3447] flex-shrink-0">
          <h3 className="font-semibold text-[#F1F5F9] flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-[#00C8FF]" />
            Members{!isLoading && ` (${members.length})`}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-lg transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto themed-scrollbar p-3 space-y-1">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-[#111E2B] animate-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-center text-[#64748B] py-8 text-sm">No members found.</p>
          ) : (
            members.map((m) => {
              const tag = extraTag(m);
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onClose();
                    navigate(`/profile/${m.id}`);
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition text-left"
                >
                  <Avatar src={m.avatar_url} name={m.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#F1F5F9] truncate">{m.full_name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <RoleBadge role={m.role} />
                      {tag && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${tag.className}`}
                        >
                          {tag.label}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
