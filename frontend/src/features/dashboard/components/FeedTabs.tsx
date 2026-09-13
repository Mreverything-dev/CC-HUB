// frontend/src/features/dashboard/components/FeedTabs.tsx
export type FeedFilter = 'all' | 'following' | 'section' | 'saved';

interface FeedTabsProps {
  active: FeedFilter;
  onChange: (filter: FeedFilter) => void;
}

const TABS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All Posts' },
  { id: 'following', label: 'Following' },
  { id: 'section', label: 'My Section' },
  { id: 'saved', label: 'Saved' },
];

export function FeedTabs({ active, onChange }: FeedTabsProps) {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-border bg-glass backdrop-blur-xl p-1.5">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
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