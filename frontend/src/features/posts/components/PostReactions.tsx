// frontend/src/features/posts/components/PostReactions.tsx
import { useEffect, useRef, useState } from 'react';
import { FaceSmileIcon } from '@heroicons/react/24/outline';

// Kept in sync with backend ALLOWED_REACTIONS (post_service.py).
export const POST_REACTIONS = ['❤️', '😂', '🔥', '😮', '😢', '😡', '🚀', '👏', '👍'];

interface PostReactionsProps {
  breakdown: Record<string, number>;
  myReaction: string | null;
  onReact: (reaction: string) => void;
  size?: 'sm' | 'md';
}

/**
 * Fully controlled - the parent (useFeed / PostDetailModal's comment list)
 * owns the actual breakdown/myReaction state and updates it both
 * optimistically on click and from incoming post:*_reaction_updated socket
 * events, so there's exactly one source of truth instead of this component
 * keeping its own copy that could drift from a real-time push.
 */
export function PostReactions({ breakdown, myReaction, onReact, size = 'sm' }: PostReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [pickerOpen]);

  const groups = Object.entries(breakdown).filter(([, count]) => count > 0);
  const totalReactions = groups.reduce((sum, [, count]) => sum + count, 0);

  const handleReact = (e: React.MouseEvent, reaction: string) => {
    e.stopPropagation();
    setPickerOpen(false);
    onReact(reaction);
  };

  const chipClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm';
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]';

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ✅ Individual reaction chips - hidden on mobile, visible on desktop */}
      <div className="hidden md:flex items-center flex-wrap gap-1">
        {groups.map(([emoji, count]) => (
          <button
            key={emoji}
            type="button"
            onClick={(e) => handleReact(e, emoji)}
            className={`flex items-center gap-1 rounded-full border transition flex-shrink-0 ${chipClass} ${
              myReaction === emoji
                ? 'bg-[#00C8FF]/15 border-[#00C8FF]/50 text-[#00C8FF]'
                : 'bg-transparent border-[#1E3447] text-[#94A3B8] hover:border-[#00C8FF]/30 hover:text-[#F1F5F9]'
            }`}
          >
            <span>{emoji}</span>
            <span>{count}</span>
          </button>
        ))}
      </div>

      {/* ✅ Reaction Picker Button with total count (visible on all devices) */}
      <div className="relative flex-shrink-0" ref={pickerRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen((v) => !v);
          }}
          title="React"
          aria-label="React"
          className={`flex items-center gap-1.5 rounded-full transition whitespace-nowrap ${chipClass} ${
            myReaction
              ? 'text-[#00C8FF]'
              : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5'
          }`}
        >
          {myReaction ? (
            <span className="text-base leading-none">{myReaction}</span>
          ) : (
            <FaceSmileIcon className={iconClass} />
          )}
          {/* ✅ Show total count on all devices */}
          {totalReactions > 0 && (
            <span className="text-xs">{totalReactions}</span>
          )}
          {groups.length === 0 && <span>React</span>}
        </button>

        {/* ✅ Reaction Picker Dropdown - Mobile Responsive */}
        {pickerOpen && (
          <>
            {/* Backdrop for mobile */}
            <div 
              className="fixed inset-0 z-30 md:hidden"
              onClick={() => setPickerOpen(false)}
            />
            
            <div 
              className={`
                absolute z-40
                ${size === 'sm' 
                  ? 'bottom-full left-0 mb-1.5' 
                  : 'bottom-full left-1/2 -translate-x-1/2 mb-2'
                }
                flex flex-wrap items-center justify-center gap-1.5 p-2.5
                min-w-[180px] max-w-[280px] sm:max-w-none
                rounded-2xl sm:rounded-full 
                border border-[#1E3447] bg-[#111E2B] shadow-xl
                ${size === 'sm' ? 'w-[212px] sm:w-auto' : 'w-[240px] sm:w-auto'}
                md:flex-nowrap
              `}
            >
              {POST_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={(e) => handleReact(e, emoji)}
                  title={emoji}
                  className={`
                    flex items-center justify-center 
                    flex-shrink-0 
                    text-lg sm:text-base 
                    rounded-full transition-transform 
                    hover:scale-125 active:scale-95
                    ${size === 'sm' ? 'h-9 w-9 sm:h-8 sm:w-8' : 'h-10 w-10 sm:h-9 sm:w-9'}
                    ${myReaction === emoji ? 'bg-[#00C8FF]/15' : ''}
                  `}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}