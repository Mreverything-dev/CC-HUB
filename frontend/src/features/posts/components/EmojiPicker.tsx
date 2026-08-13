// frontend/src/features/posts/components/EmojiPicker.tsx
import { useEffect, useRef, useState } from 'react';
import { FaceSmileIcon } from '@heroicons/react/24/outline';

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: ['😀', '😂', '🥹', '😊', '😍', '😘', '😜', '🤔', '😎', '🥳', '😭', '😡', '🙄', '😴', '🤯', '🥰'],
  },
  {
    label: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '✌️', '🤞', '👌', '🫡', '🤙'],
  },
  {
    label: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💯'],
  },
  {
    label: 'Other',
    emojis: ['🔥', '✨', '🎉', '🎊', '💀', '👀', '💡', '📌', '✅', '❌'],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  align?: 'left' | 'right';
}

export function EmojiPicker({ onSelect, align = 'left' }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        title="Add emoji"
        aria-label="Add emoji"
        className={`p-1.5 rounded-lg transition ${
          isOpen ? 'text-[#00C8FF] bg-[#00C8FF]/10' : 'text-[#64748B] hover:text-[#00C8FF] hover:bg-white/5'
        }`}
      >
        <FaceSmileIcon className="h-5 w-5" />
      </button>

      {isOpen && (
        <div
          className={`absolute bottom-full mb-2 w-64 max-h-56 overflow-y-auto themed-scrollbar rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl z-30 p-2.5 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B] mb-1 px-0.5">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onSelect(emoji);
                      setIsOpen(false);
                    }}
                    className="text-lg rounded-lg p-1 hover:bg-white/10 hover:scale-110 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
