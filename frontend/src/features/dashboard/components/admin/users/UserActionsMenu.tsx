// frontend/src/features/dashboard/components/admin/users/UserActionsMenu.tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

function ComingSoonMenuItem({ icon: Icon, label, danger }: { icon: typeof PencilSquareIcon; label: string; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      disabled
      aria-disabled="true"
      title={`${label} is coming soon`}
      className={`flex items-center gap-2 w-full px-3.5 py-2 text-sm cursor-not-allowed ${
        danger ? 'text-[#EF4444]/40' : 'text-text-muted'
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-text-muted border border-border rounded px-1.5 py-0.5 flex-shrink-0">
        Soon
      </span>
    </button>
  );
}

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
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Compute the fixed-position coordinates whenever the menu opens so the
  // dropdown is never clipped by the table's own overflow context.
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const MENU_WIDTH = 192; // w-48 = 12rem = 192px
    const MENU_MAX_HEIGHT = 400;

    // Align the menu's right edge with the trigger's right edge
    let left = rect.right - MENU_WIDTH;
    if (left < 8) left = 8;

    // If the menu would overflow the bottom of the viewport, open it upward
    const spaceBelow = window.innerHeight - rect.bottom;
    let top = rect.bottom + 4;
    if (spaceBelow < MENU_MAX_HEIGHT && rect.top > MENU_MAX_HEIGHT) {
      top = rect.top - MENU_MAX_HEIGHT - 4;
    }
    if (top < 8) top = 8;

    setMenuPosition({ top, left });
  }, [isOpen]);

  // Close on outside click, scroll, or resize
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleScrollOrResize = () => setIsOpen(false);
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((v) => !v)}
        title="Actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-glass transition"
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed w-48 max-h-[400px] overflow-y-auto scrollbar-hide rounded-xl border border-border bg-bg shadow-2xl py-1 z-[9999]"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <button
            role="menuitem"
            onClick={() => { setIsOpen(false); onViewDetails(user); }}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition"
          >
            <UserCircleIcon className="h-4 w-4" />
            View Details
          </button>
          <button
            role="menuitem"
            onClick={() => { setIsOpen(false); navigate(`/profile/${user.id}`); }}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition"
          >
            <IdentificationIcon className="h-4 w-4" />
            View Profile
          </button>
          <button
            role="menuitem"
            onClick={() => { setIsOpen(false); onChangeRole(user); }}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition"
          >
            <ShieldCheckIcon className="h-4 w-4" />
            Change Role
          </button>
          <button
            role="menuitem"
            onClick={() => { setIsOpen(false); onEditUser(user); }}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition"
          >
            <PencilSquareIcon className="h-4 w-4" />
            Edit User
          </button>
          <div className="my-1 border-t border-border" />
          <button
            role="menuitem"
            onClick={() => { setIsOpen(false); onToggleStatus(user); }}
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
            onClick={() => { setIsOpen(false); onSetPassword(user); }}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-text-secondary hover:bg-glass hover:text-text-primary transition"
          >
            <KeyIcon className="h-4 w-4" />
            Reset Password
          </button>
          <div className="my-1 border-t border-border" />
          <ComingSoonMenuItem icon={UserGroupIcon} label="Assign Section" />
          <button
            role="menuitem"
            onClick={() => { setIsOpen(false); onDeleteUser(user); }}
            className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#EF4444] hover:bg-[#EF4444]/10 transition"
          >
            <TrashIcon className="h-4 w-4" />
            Delete User
          </button>
        </div>
      )}
    </>
  );
}