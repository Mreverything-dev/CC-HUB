// frontend/src/features/dashboard/components/Avatar.tsx
import { useEffect, useState } from 'react';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  /** Opt-in only - callers that don't pass this get the exact same avatar as
   * before. When true, shows a small pulsing "LIVE" ring + dot to mark that
   * this person currently has an active livestream. */
  isLive?: boolean;
}

const sizeClasses: Record<string, string> = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-sm',
  md: 'w-11 h-11 text-base',
  lg: 'w-14 h-14 text-lg',
};

const liveDotClasses: Record<string, string> = {
  xs: 'h-2 w-2 border',
  sm: 'h-2.5 w-2.5 border',
  md: 'h-3 w-3 border-2',
  lg: 'h-3.5 w-3.5 border-2',
};

export function Avatar({ src, name, size = 'md', className = '', isLive = false }: AvatarProps) {
  const initial = name?.charAt(0).toUpperCase() || 'U';
  // A broken/invalid URL (404, unreachable host, etc.) would otherwise leave
  // the browser's own broken-image icon showing forever - falling back to
  // the same initials shown for "no avatar at all" instead. Resets whenever
  // the URL itself changes, so a fixed/different avatar gets a fresh try.
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [src]);
  const showImage = !!src && !imgFailed;

  return (
    <div className={`relative flex-shrink-0 ${isLive ? 'rounded-full ring-2 ring-[#EF4444] ring-offset-2 ring-offset-[#07111A]' : ''}`}>
      <div
        className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] flex items-center justify-center font-bold text-[#060B12] overflow-hidden flex-shrink-0 ${className}`}
      >
        {showImage ? (
          <img
            src={src as string}
            alt={name || 'User'}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          initial
        )}
      </div>
      {isLive && (
        <span
          title="Live now"
          className={`absolute -bottom-0.5 -right-0.5 ${liveDotClasses[size]} rounded-full bg-[#EF4444] border-[#07111A] animate-pulse`}
        />
      )}
    </div>
  );
}
