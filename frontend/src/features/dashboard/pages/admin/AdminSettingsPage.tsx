// frontend/src/features/dashboard/pages/admin/AdminSettingsPage.tsx
import { KeyIcon, UserCircleIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { ProfessorCodesPanel } from '../../components/admin/users/ProfessorCodesPanel';
import { AdminSection } from '../../components/admin/AdminSidebar';

interface AdminSettingsPageProps {
  onNavigate: (section: AdminSection) => void;
}

export default function AdminSettingsPage({ onNavigate }: AdminSettingsPageProps) {
  const { user } = useAuthStore();

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1 text-sm">Account and system configuration.</p>
      </div>

      <div className="rounded-2xl border border-[#8B5CF6]/15 bg-glass p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-4">
          <UserCircleIcon className="h-4 w-4 text-[#8B5CF6]" />
          Your Account
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-primary">{user?.username}</span>
          <RoleBadge role="admin" />
        </div>
        <p className="text-xs text-text-muted mt-1">{user?.email}</p>
      </div>

      <div className="rounded-2xl border border-[#8B5CF6]/15 bg-glass p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <KeyIcon className="h-4 w-4 text-[#8B5CF6]" />
            Professor Registration Codes
          </h3>
          <button
            onClick={() => onNavigate('users')}
            className="flex items-center gap-1 text-xs text-[#8B5CF6] hover:underline"
          >
            Manage in Users
            <ArrowTopRightOnSquareIcon className="h-3 w-3" />
          </button>
        </div>
        <p className="text-xs text-text-muted mb-4">
          Generate the single-use codes professors need to complete registration. This is also available on the Users page.
        </p>
        <ProfessorCodesPanel />
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-glass p-5">
        <p className="text-sm text-text-secondary">
          Platform-wide settings (email templates, feature flags, retention policies) aren't implemented yet - this
          page currently covers what's actually configurable today.
        </p>
      </div>
    </div>
  );
}