// frontend/src/features/dashboard/constants/reportCategories.ts
import type { AdminReportCategory } from '@/services/api/admin.service';

export interface ReportCategoryMeta {
  value: AdminReportCategory;
  label: string;
  emoji: string;
  colorClass: string;
}

// Emoji + color mapping matches the categories' real-world severity, same
// pairing used across the admin dashboard's other badge systems.
export const REPORT_CATEGORIES: ReportCategoryMeta[] = [
  { value: 'bullying', label: 'Bullying', emoji: '🔴', colorClass: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/30' },
  { value: 'harassment', label: 'Harassment', emoji: '🟠', colorClass: 'text-[#F97316] bg-[#F97316]/10 border-[#F97316]/30' },
  { value: 'abuse', label: 'Abuse', emoji: '🔴', colorClass: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/30' },
  { value: 'violent_content', label: 'Violent Content', emoji: '🔴', colorClass: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/30' },
  { value: 'adult_content', label: 'Adult Content', emoji: '🟣', colorClass: 'text-[#A855F7] bg-[#A855F7]/10 border-[#A855F7]/30' },
  { value: 'false_information', label: 'False Information', emoji: '🟡', colorClass: 'text-[#EAB308] bg-[#EAB308]/10 border-[#EAB308]/30' },
  { value: 'suicide_self_harm', label: 'Suicide / Self-Harm', emoji: '🔴', colorClass: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/30' },
];

export const REPORT_CATEGORY_BY_VALUE: Record<string, ReportCategoryMeta> = Object.fromEntries(
  REPORT_CATEGORIES.map((c) => [c.value, c])
);

export function getReportCategoryMeta(category: string, fallbackLabel: string): ReportCategoryMeta {
  return (
    REPORT_CATEGORY_BY_VALUE[category] || {
      value: category as AdminReportCategory,
      label: fallbackLabel,
      emoji: '⚪',
      colorClass: 'text-[#94A3B8] bg-white/5 border-[#1E3447]',
    }
  );
}

export const REPORT_STATUSES: { value: 'pending' | 'valid' | 'dismissed'; label: string; colorClass: string }[] = [
  { value: 'pending', label: 'Pending Review', colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  { value: 'valid', label: 'Valid', colorClass: 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/30' },
  { value: 'dismissed', label: 'Dismissed', colorClass: 'text-[#64748B] bg-white/5 border-[#1E3447]' },
];

export function getReportStatusMeta(status: string) {
  return REPORT_STATUSES.find((s) => s.value === status) || REPORT_STATUSES[0];
}

export const RESTRICTION_DURATIONS: { value: '1d' | '1w' | '1m'; label: string; days: number }[] = [
  { value: '1d', label: '1 Day', days: 1 },
  { value: '1w', label: '1 Week', days: 7 },
  { value: '1m', label: '1 Month', days: 30 },
];
