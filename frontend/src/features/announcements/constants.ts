// frontend/src/features/announcements/constants.ts
import {
  MegaphoneIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Announcement } from '@/types/announcement.types';

export type AnnouncementCategory = Announcement['type'];

export const CATEGORY_META: Record<
  AnnouncementCategory,
  { label: string; icon: typeof MegaphoneIcon; color: string; bg: string; border: string }
> = {
  general: {
    label: 'General',
    icon: MegaphoneIcon,
    color: 'text-[#00C8FF]',
    bg: 'bg-[#00C8FF]/10',
    border: 'border-[#00C8FF]/30',
  },
  academic: {
    label: 'Academic',
    icon: AcademicCapIcon,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  event: {
    label: 'Event',
    icon: CalendarDaysIcon,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
  },
  emergency: {
    label: 'Emergency',
    icon: ExclamationTriangleIcon,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
};

export const CATEGORY_FILTER_OPTIONS: { value: 'all' | AnnouncementCategory; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'general', label: 'General' },
  { value: 'academic', label: 'Academic' },
  { value: 'event', label: 'Event' },
  { value: 'emergency', label: 'Emergency' },
];

export function matchesAnnouncementFilters(
  announcement: Announcement,
  search: string,
  category: 'all' | AnnouncementCategory
): boolean {
  if (category !== 'all' && announcement.type !== category) return false;
  if (!search.trim()) return true;
  const q = search.trim().toLowerCase();
  return (
    announcement.title.toLowerCase().includes(q) ||
    announcement.content.toLowerCase().includes(q)
  );
}
