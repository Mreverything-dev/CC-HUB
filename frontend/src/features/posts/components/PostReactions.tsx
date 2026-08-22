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

  const handleReact = (e: React.MouseEvent, reaction: string) => {
    e.stopPropagation();
    setPickerOpen(false);
    onReact(reaction);
  };

  const chipClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm';
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]';

  return (
    // flex-nowrap + overflow-x-auto instead of flex-wrap: this row sits next
    // to the comment-count/share/save buttons in a shared action bar, so on
    // a narrow phone there often isn't room for every distinct reaction chip
    // side by side - wrapping pushed the overflow chips onto their own
    // line(s) directly underneath, which read as a tall vertical stack
    // instead of a row. Scrolling horizontally keeps it a single row on any
    // screen width; flex-shrink-0 on each chip stops them from being
    // squashed to make room instead.
    <div
      className="flex items-center flex-nowrap gap-1 overflow-x-auto themed-scrollbar"
      onClick={(e) => e.stopPropagation()}
    >
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
          {myReaction ? <span className="text-base leading-none">{myReaction}</span> : <FaceSmileIcon className={iconClass} />}
          {groups.length === 0 && <span>React</span>}
        </button>
        {pickerOpen && (
          // All 9 reactions in one un-wrapped row need ~350px (9 buttons +
          // gaps + padding) - wider than most phone screens, so it either
          // overflowed the viewport or got clipped by an ancestor card's
          // rounded-corner overflow-hidden, leaving a cramped, oddly
          // narrow/tall-looking sliver instead of the intended row. Capping
          // the width and letting it wrap turns that into a clean 5+4 grid
          // on mobile; sm: and up has room for the original single pill row.
          <div className="absolute bottom-full left-0 mb-1.5 flex flex-wrap sm:flex-nowrap items-center gap-1 p-2 w-[212px] sm:w-auto rounded-2xl sm:rounded-full border border-[#1E3447] bg-[#111E2B] shadow-xl z-20">
            {POST_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={(e) => handleReact(e, emoji)}
                title={emoji}
                className={`flex items-center justify-center flex-shrink-0 h-9 w-9 sm:h-8 sm:w-8 text-lg rounded-full transition-transform hover:scale-125 active:scale-95 ${
                  myReaction === emoji ? 'bg-[#00C8FF]/15' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
