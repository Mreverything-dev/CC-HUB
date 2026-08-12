// frontend/src/features/friends/components/FriendAvatar.tsx
interface FriendAvatarProps {
  avatar: string | null | undefined;
  name: string;
  isOnline?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<string, string> = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
};

const DOT_CLASSES: Record<string, string> = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3.5 w-3.5',
};

export function FriendAvatar({ avatar, name, isOnline, size = 'md' }: FriendAvatarProps) {
  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${SIZE_CLASSES[size]} rounded-full bg-[#111E2B] border border-[#1E3447] flex items-center justify-center overflow-hidden`}
      >
        {avatar ? (
          <img src={avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="font-semibold text-[#94A3B8]">{name?.charAt(0).toUpperCase() || 'U'}</span>
        )}
      </div>
      {isOnline !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${DOT_CLASSES[size]} rounded-full border-2 border-[#0D1722] ${
            isOnline ? 'bg-[#22C55E]' : 'bg-[#64748B]'
          }`}
        />
      )}
    </div>
  );
}
