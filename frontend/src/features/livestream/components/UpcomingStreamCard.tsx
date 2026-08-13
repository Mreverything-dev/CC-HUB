// frontend/src/features/livestream/components/UpcomingStreamCard.tsx
import { BellIcon, BellAlertIcon, GlobeAltIcon, UserIcon, UserGroupIcon, ClockIcon } from '@heroicons/react/24/outline';
import { formatRelativeTime } from '@/lib/formatters';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { Livestream } from '@/types/livestream.types';

const VISIBILITY_META: Record<string, { icon: typeof GlobeAltIcon; label: string }> = {
  public: { icon: GlobeAltIcon, label: 'Public' },
  friends: { icon: UserIcon, label: 'Friends Only' },
  section: { icon: UserGroupIcon, label: 'Section' },
};

interface UpcomingStreamCardProps {
  stream: Livestream;
  sectionName?: string | null;
  isReminderSet: boolean;
  onToggleReminder: () => void;
}

export function UpcomingStreamCard({ stream, sectionName, isReminderSet, onToggleReminder }: UpcomingStreamCardProps) {
  const visibility = VISIBILITY_META[stream.visibility] ?? VISIBILITY_META.public;
  const VisibilityIcon = visibility.icon;
  const audienceLabel = stream.visibility === 'section' ? sectionName || 'Section' : visibility.label;

  return (
    <div className="rounded-2xl border border-[#1E3447] bg-[#0A111A] overflow-hidden transition-all duration-200 hover:border-[#8B5CF6]/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.1)]">
      {/* Preview */}
      <div className="relative aspect-video bg-gradient-to-br from-[#0D1722] via-[#0A111A] to-[#1a1330] flex items-center justify-center">
        <ClockIcon className="h-9 w-9 text-[#1E3447]" />
        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 text-[#8B5CF6] text-[10px] font-bold uppercase tracking-wide">
          Scheduled
        </span>
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[#94A3B8] text-[10px] font-medium">
          <VisibilityIcon className="h-3 w-3" />
          {visibility.label}
        </div>
      </div>

      <div className="p-3.5">
        <div className="flex items-center gap-2.5 mb-2">
          <Avatar src={stream.host_avatar} name={stream.host_username} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#F1F5F9] truncate">{stream.host_username}</p>
            <p className="text-[11px] text-[#64748B]">
              Created {formatRelativeTime(stream.created_at)}
            </p>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-[#F1F5F9] line-clamp-1">{stream.title}</h3>

        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8B5CF6] bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 rounded-full px-2 py-0.5">
            {audienceLabel}
          </span>
          <button
            onClick={onToggleReminder}
            title={isReminderSet ? "You'll be notified" : 'Remind me'}
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition ${
              isReminderSet
                ? 'text-[#00C8FF] bg-[#00C8FF]/10'
                : 'text-[#94A3B8] hover:text-[#00C8FF] hover:bg-white/5'
            }`}
          >
            {isReminderSet ? <BellAlertIcon className="h-3.5 w-3.5" /> : <BellIcon className="h-3.5 w-3.5" />}
            {isReminderSet ? 'Reminded' : 'Remind me'}
          </button>
        </div>
      </div>
    </div>
  );
}
