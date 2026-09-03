// frontend/src/features/dashboard/components/admin/users/UserActionsMenu.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EllipsisVerticalIcon,
  UserCircleIcon,
  IdentificationIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  KeyIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { AdminUserListItem } from '@/services/api/admin.service';

interface UserActionsMenuProps {
  user: AdminUserListItem;
  onToggleStatus: (user: AdminUserListItem) => void;
  onViewDetails: (user: AdminUserListItem) => void;
  onChangeRole: (user: AdminUserListItem) => void;
  onEditUser: (user: AdminUserListItem) => void;
  onSetPassword: (user: AdminUserListItem) => void;
  onDeleteUser: (user: AdminUserListItem) => void;
}

/** A real, disabled `<button>` (not just muted styling) - it physically
 * cannot receive a click, so there is no path to an onClick handler, an API
 * call, or any state change for these four out-of-scope actions. The
 * "Soon" pill mirrors the exact convention the main Sidebar already uses
 * for its own comingSoon nav items. */
function ComingSoonMenuItem({ icon: Icon, label, danger }: { icon: typeof PencilSquareIcon; label: string; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      disabled
      aria-disabled="true"
      title={`${label} is coming soon`}
      className={`flex items-center gap-2 w-full px-3.5 py-2 text-sm cursor-not-allowed ${
        danger ? 'text-[#EF4444]/40' : 'text-[#5B6B80]'
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-[#3D4A5C] border border-[#1E3447] rounded px-1.5 py-0.5 flex-shrink-0">
        Soon
      </span>
    </button>
  );
}

/**
 * "View Profile", "View Details", "Change Role", Suspend/Activate, Edit
 * User, Reset Password (set a new one directly), and Delete User are all
 * real and backend-verified. "Assign Section" remains out of scope - it
 * renders as a disabled ComingSoonMenuItem with no onClick at all, so
 * there is zero chance of triggering a request for it.
 */
export function UserActionsMenu({
  user,
  onToggleStatus,
  onViewDetails,
  onChangeRole,
  onEditUser,
  onSetPassword,
  onDeleteUser,
}: UserActionsMenuProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        title="Actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="p-1.5 rounded-lg text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 transition"
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-48 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl py-1 z-30"
        >
          <button
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onViewDetails(user);
            }}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
          >
            <UserCircleIcon className="h-4 w-4" />
            View Details
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              navigate(`/profile/${user.id}`);
            }}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
          >
            <IdentificationIcon className="h-4 w-4" />
            View Profile
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onChangeRole(user);
            }}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
          >
            <ShieldCheckIcon className="h-4 w-4" />
            Change Role
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onEditUser(user);
            }}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
          >
            <PencilSquareIcon className="h-4 w-4" />
            Edit User
          </button>
          <div className="my-1 border-t border-[#1E3447]" />
          <button
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onToggleStatus(user);
            }}
            className={`flex items-center gap-2 w-full px-3.5 py-2 text-sm transition ${
              user.is_active
                ? 'text-[#F59E0B] hover:bg-[#F59E0B]/10'
                : 'text-[#22C55E] hover:bg-[#22C55E]/10'
            }`}
          >
            {user.is_active ? <NoSymbolIcon className="h-4 w-4" /> : <CheckCircleIcon className="h-4 w-4" />}
            {user.is_active ? 'Suspend User' : 'Activate User'}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onSetPassword(user);
            }}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
          >
            <KeyIcon className="h-4 w-4" />
            Reset Password
          </button>
          <div className="my-1 border-t border-[#1E3447]" />
          {/* Out of scope for this task - see ComingSoonMenuItem's docstring
              above. Disabled, no onClick, no API calls possible. */}
          <ComingSoonMenuItem icon={UserGroupIcon} label="Assign Section" />
          <button
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onDeleteUser(user);
            }}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#EF4444] hover:bg-[#EF4444]/10 transition"
          >
            <TrashIcon className="h-4 w-4" />
            Delete User
          </button>
        </div>
      )}
    </div>
  );
}
