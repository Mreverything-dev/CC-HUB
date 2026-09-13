// frontend/src/features/dashboard/components/admin/QuickActionsWidget.tsx
import { useNavigate } from 'react-router-dom';
import {
  UserPlusIcon,
  MegaphoneIcon,
  UserGroupIcon,
  FlagIcon,
  VideoCameraIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface QuickActionsWidgetProps {
  onCreateAnnouncement: () => void;
  onCreateSection: () => void;
}

export function QuickActionsWidget({ onCreateAnnouncement, onCreateSection }: QuickActionsWidgetProps) {
  const navigate = useNavigate();

  const actions = [
    { label: 'Create Announcement', icon: MegaphoneIcon, onClick: onCreateAnnouncement },
    { label: 'Create Section', icon: UserGroupIcon, onClick: onCreateSection },
    { label: 'Manage Live Streams', icon: VideoCameraIcon, onClick: () => navigate('/livestreams') },
    { label: 'View Reports', icon: FlagIcon, onClick: () => toast('Reports list is coming soon') },
    { label: 'Add User', icon: UserPlusIcon, onClick: () => toast('Admin user management is coming soon') },
  ];

  return (
    <div className="rounded-2xl border border-border bg-glass backdrop-blur-xl p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Quick Actions</h3>
      <div className="space-y-1">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-text-primary hover:bg-glass rounded-xl transition"
          >
            <span className="flex items-center gap-2.5">
              <action.icon className="h-4 w-4 text-[#00C8FF]" />
              {action.label}
            </span>
            <ChevronRightIcon className="h-3.5 w-3.5 text-text-muted" />
          </button>
        ))}
      </div>
    </div>
  );
}