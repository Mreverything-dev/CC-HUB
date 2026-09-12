// frontend/src/features/dashboard/components/FeedTabs.tsx
export type FeedFilter = 'all' | 'following' | 'section' | 'video';

interface FeedTabsProps {
  active: FeedFilter;
  onChange: (filter: FeedFilter) => void;
}

const TABS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All Posts' },
  { id: 'following', label: 'Friends' },
  { id: 'section', label: 'My Section' },
  { id: 'video', label: 'Videos' },
];

export function FeedTabs({ active, onChange }: FeedTabsProps) {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-[rgba(0,200,245,0.18)] bg-[rgba(15,28,40,0.75)] backdrop-blur-xl p-1.5">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 px-2 py-2 text-xs font-medium rounded-xl transition-all duration-200 sm:flex-none sm:px-4 sm:text-sm ${
            active === tab.id
              ? 'bg-[#00C8FF]/15 text-[#00C8FF] shadow-[0_0_12px_rgba(0,200,245,0.18)]'
              : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}