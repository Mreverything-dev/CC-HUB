// frontend/src/features/livestream/components/LiveStreamCard.tsx
import { EyeIcon, GlobeAltIcon, UserIcon, UserGroupIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { Livestream } from '@/types/livestream.types';

const VISIBILITY_META: Record<string, { icon: typeof GlobeAltIcon; label: string }> = {
  public: { icon: GlobeAltIcon, label: 'Public' },
  friends: { icon: UserIcon, label: 'Friends Only' },
  section: { icon: UserGroupIcon, label: 'Section' },
};

interface LiveStreamCardProps {
  stream: Livestream;
  sectionName?: string | null;
  onClick: () => void;
}

export function LiveStreamCard({ stream, sectionName, onClick }: LiveStreamCardProps) {
  const visibility = VISIBILITY_META[stream.visibility] ?? VISIBILITY_META.public;
  const VisibilityIcon = visibility.icon;
  const audienceLabel = stream.visibility === 'section' ? sectionName || 'Section' : visibility.label;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group rounded-2xl border border-[#1E3447] bg-[#0A111A] overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-[#00C8FF]/50 hover:shadow-[0_0_28px_rgba(0,200,255,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8FF]/60"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gradient-to-br from-[#0D1722] via-[#0A111A] to-[#162534] overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <VideoCameraIcon className="h-10 w-10 text-[#1E3447] group-hover:text-[#00C8FF]/30 transition-colors" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060B12]/70 via-transparent to-transparent" />

        {/* LIVE + viewers */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EF4444] text-white text-[10px] font-bold uppercase tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Live
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[#F1F5F9] text-[10px] font-medium">
            <EyeIcon className="h-3 w-3" />
            {stream.viewer_count}
          </span>
        </div>

        {/* Visibility */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[#94A3B8] text-[10px] font-medium">
          <VisibilityIcon className="h-3 w-3" />
          {visibility.label}
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5">
        <div className="flex items-center gap-2.5 mb-2">
          <Avatar src={stream.host_avatar} name={stream.host_username} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#F1F5F9] truncate">{stream.host_username}</p>
            <RoleBadge role={stream.host_role} className="mt-0.5" />
          </div>
        </div>

        <h3 className="text-sm font-semibold text-[#F1F5F9] line-clamp-1 group-hover:text-[#00C8FF] transition-colors">
          {stream.title}
        </h3>

        <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wide text-[#00C8FF] bg-[#00C8FF]/10 border border-[#00C8FF]/25 rounded-full px-2 py-0.5">
          {audienceLabel}
        </span>
      </div>
    </div>
  );
}
