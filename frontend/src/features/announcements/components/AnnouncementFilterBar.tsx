// frontend/src/features/announcements/components/AnnouncementFilterBar.tsx
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { AnnouncementCategory, CATEGORY_FILTER_OPTIONS } from '../constants';

interface AnnouncementFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: 'all' | AnnouncementCategory;
  onCategoryChange: (value: 'all' | AnnouncementCategory) => void;
}

export function AnnouncementFilterBar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
}: AnnouncementFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <MagnifyingGlassIcon className="h-4 w-4 text-[#6b6b6b] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search announcements..."
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] text-sm text-white placeholder-[#6b6b6b] focus:ring-1 focus:ring-[#00d4ff] focus:border-[#00d4ff] focus:outline-none transition"
        />
      </div>
      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value as 'all' | AnnouncementCategory)}
        className="px-3 py-2 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] text-sm text-white focus:ring-1 focus:ring-[#00d4ff] focus:border-[#00d4ff] focus:outline-none transition sm:w-48"
      >
        {CATEGORY_FILTER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
