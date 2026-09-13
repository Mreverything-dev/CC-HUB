// frontend/src/features/posts/components/PostReactions.tsx
import { useState, useRef, useEffect } from 'react';
import { FaceSmileIcon } from '@heroicons/react/24/outline';

// Final left-to-right order in the picker
export const POST_REACTIONS = ['❤️', '😂', '🔥', '😮', '😢', '😡', '🚀', '👏', '👍'];

// Order in which emojis appear (staggered animation).
const APPEAR_ORDER = ['👍', '👏', '🚀', '😡', '😢', '😮', '🔥', '😂', '❤️'];

const STAGGER_MS = 40;

interface PostReactionsProps {
  breakdown: Record<string, number>;
  myReaction: string | null;
  onReact: (reaction: string) => void;
  size?: 'sm' | 'md';
}

export function PostReactions({ breakdown, onReact, size = 'sm' }: PostReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const hoverOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staggerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const groups = Object.entries(breakdown)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  const totalCount = groups.reduce((sum, [, count]) => sum + count, 0);
  const topEmojis = groups.slice(0, 3).map(([emoji]) => emoji);

  const clearTimers = () => {
    if (hoverOpenTimerRef.current) {
      clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
    if (staggerTimerRef.current) {
      clearInterval(staggerTimerRef.current);
      staggerTimerRef.current = null;
    }
  };

  const startStagger = () => {
    setVisibleCount(0);
    let i = 0;
    staggerTimerRef.current = setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= APPEAR_ORDER.length && staggerTimerRef.current) {
        clearInterval(staggerTimerRef.current);
        staggerTimerRef.current = null;
      }
    }, STAGGER_MS);
  };

  const handleTriggerEnter = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
    if (pickerOpen) return;
    hoverOpenTimerRef.current = setTimeout(() => {
      setPickerOpen(true);
      startStagger();
    }, 200);
  };

  const handleTriggerLeave = () => {
    if (hoverOpenTimerRef.current) {
      clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    hoverCloseTimerRef.current = setTimeout(() => {
      setPickerOpen(false);
      setVisibleCount(0);
      setHoveredEmoji(null);
    }, 300);
  };

  const handlePickerEnter = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const handlePickerLeave = () => {
    setHoveredEmoji(null);
    hoverCloseTimerRef.current = setTimeout(() => {
      setPickerOpen(false);
      setVisibleCount(0);
    }, 300);
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
        setVisibleCount(0);
        setHoveredEmoji(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [pickerOpen]);

  const handleReact = (e: React.MouseEvent, reaction: string) => {
    e.stopPropagation();
    setPickerOpen(false);
    setVisibleCount(0);
    setHoveredEmoji(null);
    onReact(reaction);
  };

  const chipClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm';
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]';
  const circleSize = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const emojiSize = size === 'sm' ? 'text-[12px]' : 'text-[14px]';

  return (
    <div
      className="relative flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
      ref={pickerRef}
    >
      {/* Reaction pill - overlapping emojis + total count.
          No outer border — only the emoji circles have their own
          border-bg "cutout" ring for the overlap effect. */}
      {groups.length > 0 ? (
        <button
          type="button"
          onMouseEnter={handleTriggerEnter}
          onMouseLeave={handleTriggerLeave}
          onClick={(e) => {
            e.stopPropagation();
            if (!pickerOpen) {
              setPickerOpen(true);
              startStagger();
            } else {
              setPickerOpen(false);
              setVisibleCount(0);
            }
          }}
          title={groups.map(([emoji, count]) => `${emoji} ${count}`).join(', ')}
          className={`flex items-center rounded-full bg-glass hover:bg-glass-hover transition flex-shrink-0 ${chipClass}`}
        >
          <span className="flex items-center -space-x-1.5">
            {topEmojis.map((emoji, i) => (
              <span
                key={`top-${emoji}-${i}`}
                className={`flex items-center justify-center rounded-full bg-bg border-2 border-bg shadow-sm ${circleSize}`}
                style={{ zIndex: topEmojis.length - i }}
              >
                <span className={emojiSize}>{emoji}</span>
              </span>
            ))}
          </span>
          <span className="ml-1.5 text-text-secondary font-medium">{totalCount}</span>
        </button>
      ) : (
        <button
          type="button"
          onMouseEnter={handleTriggerEnter}
          onMouseLeave={handleTriggerLeave}
          onClick={(e) => {
            e.stopPropagation();
            if (!pickerOpen) {
              setPickerOpen(true);
              startStagger();
            } else {
              setPickerOpen(false);
              setVisibleCount(0);
            }
          }}
          title="React"
          aria-label="React"
          className={`flex items-center justify-center rounded-full transition text-text-secondary hover:text-text-primary hover:bg-glass-hover ${chipClass}`}
        >
          <FaceSmileIcon className={iconClass} />
        </button>
      )}

      {/* Staggered reaction picker */}
      {pickerOpen && (
        <div
          onMouseEnter={handlePickerEnter}
          onMouseLeave={handlePickerLeave}
          className="absolute z-50 bottom-full left-0 mb-2 flex items-end gap-1 p-2 rounded-full border border-border bg-bg shadow-2xl whitespace-nowrap"
          style={{ animation: 'reactionSlideUp 0.2s ease-out forwards' }}
        >
          {POST_REACTIONS.map((emoji) => {
            const appearIdx = APPEAR_ORDER.indexOf(emoji);
            const isVisible = appearIdx < visibleCount;
            const isHovered = hoveredEmoji === emoji;
            return (
              <button
                key={`picker-${emoji}`}
                type="button"
                onMouseEnter={() => setHoveredEmoji(emoji)}
                onMouseLeave={() => setHoveredEmoji((prev) => (prev === emoji ? null : prev))}
                onClick={(e) => handleReact(e, emoji)}
                title={emoji}
                className="flex items-center justify-center flex-shrink-0 text-2xl"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible
                    ? isHovered
                      ? 'translateY(-8px) scale(1.5)'
                      : 'translateY(0) scale(1)'
                    : 'translateX(-20px) scale(0.4)',
                  transition:
                    'opacity 120ms ease-out, transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  pointerEvents: isVisible ? 'auto' : 'none',
                }}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}