// frontend/src/features/dashboard/components/admin/users/UserActionsMenu.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  EllipsisVerticalIcon,
  UserCircleIcon,
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
}

/**
 * Only "View Profile" (existing route) and Suspend/Activate (the endpoint
 * this task added) are real. Everything else has no backend support yet, so
 * it's an honest "coming soon" rather than a dead-end that pretends to work.
 */
export function UserActionsMenu({ user, onToggleStatus }: UserActionsMenuProps) {
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

  const comingSoon = (label: string) => {
    setIsOpen(false);
    toast(`${label} is coming soon`);
  };

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
              navigate(`/profile/${user.id}`);
            }}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
          >
            <UserCircleIcon className="h-4 w-4" />
            View Profile
          </button>
          <button
            role="menuitem"
            onClick={() => comingSoon('Editing users')}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
          >
            <PencilSquareIcon className="h-4 w-4" />
            Edit User
          </button>
          <button
            role="menuitem"
            onClick={() => comingSoon('Changing roles')}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
          >
            <ShieldCheckIcon className="h-4 w-4" />
            Change Role
          </button>
          <button
            role="menuitem"
            onClick={() => comingSoon('Section assignment')}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
          >
            <UserGroupIcon className="h-4 w-4" />
            Assign Section
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
            onClick={() => comingSoon('Password reset')}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
          >
            <KeyIcon className="h-4 w-4" />
            Reset Password
          </button>
          <button
            role="menuitem"
            onClick={() => comingSoon('Deleting users')}
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
