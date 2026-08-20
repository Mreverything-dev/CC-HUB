// frontend/src/features/announcements/components/AnnouncementFilterBar.tsx
import { ReactNode } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { AnnouncementCategory, CATEGORY_FILTER_OPTIONS } from '../constants';

interface AnnouncementFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: 'all' | AnnouncementCategory;
  onCategoryChange: (value: 'all' | AnnouncementCategory) => void;
  /** Rendered at the end of the row (e.g. a "New Announcement" button) so it sits beside the search input. */
  actionSlot?: ReactNode;
}

export function AnnouncementFilterBar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  actionSlot,
}: AnnouncementFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
      <div className="relative w-full sm:w-56">
        <MagnifyingGlassIcon className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search announcements..."
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#1E3447] bg-[#0A111A] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none transition"
        />
      </div>
      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value as 'all' | AnnouncementCategory)}
        className="px-3 py-2 rounded-xl border border-[#1E3447] bg-[#0A111A] text-sm text-[#F1F5F9] focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none transition sm:w-40"
      >
        {CATEGORY_FILTER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {actionSlot && <div className="sm:ml-auto">{actionSlot}</div>}
    </div>
  );
}
