// frontend/src/features/dashboard/components/FeedTabs.tsx
export type FeedFilter = 'all' | 'friends' | 'videos';

interface FeedTabsProps {
  active: FeedFilter;
  onChange: (filter: FeedFilter) => void;
  /** Optional: hide the "Friends" tab (e.g. on Professor dashboard where it doesn't apply). */
  hideFriends?: boolean;
}

const TABS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All Posts' },
  { id: 'friends', label: 'Friends' },
  { id: 'videos', label: 'Videos' },
];

export function FeedTabs({ active, onChange, hideFriends = false }: FeedTabsProps) {
  const visibleTabs = hideFriends ? TABS.filter((t) => t.id !== 'friends') : TABS;
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-border bg-glass backdrop-blur-xl p-1.5">
      {visibleTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 px-2 py-2 text-xs font-medium rounded-xl transition-all duration-200 sm:flex-none sm:px-4 sm:text-sm ${
            active === tab.id
              ? 'bg-[#00C8FF]/15 text-[#00C8FF] shadow-[0_0_12px_rgba(0,200,245,0.18)]'
              : 'text-text-secondary hover:text-text-primary hover:bg-glass'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}