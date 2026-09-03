// frontend/src/features/posts/components/ReportPostDialog.tsx
import { useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { PostReportCategory } from '@/services/api/post.service';

interface ReportPostDialogProps {
  isLoading: boolean;
  onSubmit: (reason: PostReportCategory, details: string) => void;
  onCancel: () => void;
}

const CATEGORIES: { value: PostReportCategory; label: string; description: string }[] = [
  { value: 'bullying', label: 'Bullying', description: 'Targeting, humiliating, or repeatedly attacking another person.' },
  { value: 'harassment', label: 'Harassment', description: 'Threatening, intimidating, or repeatedly bothering another person.' },
  { value: 'abuse', label: 'Abuse', description: 'Abusive, exploitative, coercive, or harmful behavior.' },
  { value: 'violent_content', label: 'Violent Content', description: 'Threats, promotion, or graphic depictions of violence.' },
  { value: 'adult_content', label: 'Adult Content', description: 'Sexual, explicit, or inappropriate adult content.' },
  { value: 'false_information', label: 'False Information', description: 'False or misleading information presented as factual.' },
  { value: 'suicide_self_harm', label: 'Suicide / Self-Harm', description: 'Content encouraging, promoting, or depicting suicide or self-harm.' },
];

export function ReportPostDialog({ isLoading, onSubmit, onCancel }: ReportPostDialogProps) {
  const [reason, setReason] = useState<PostReportCategory | null>(null);
  const [details, setDetails] = useState('');

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]"
      onClick={() => !isLoading && onCancel()}
    >
      <div
        className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center h-12 w-12 rounded-full mx-auto mb-4 border bg-[#EF4444]/10 border-[#EF4444]/30">
          <ExclamationTriangleIcon className="h-6 w-6 text-[#EF4444]" />
        </div>
        <h3 className="text-base font-semibold text-[#F1F5F9] text-center">Report Post</h3>
        <p className="text-sm text-[#94A3B8] text-center mt-2">
          Why are you reporting this post? Your identity stays anonymous.
        </p>

        <div className="mt-4 space-y-2">
          {CATEGORIES.map((c) => (
            <label
              key={c.value}
              className={`flex flex-col gap-0.5 px-3 py-2 rounded-xl border text-sm cursor-pointer transition ${
                reason === c.value
                  ? 'border-[#00C8FF]/50 bg-[#00C8FF]/10'
                  : 'border-[#1E3447] hover:border-[#1E3447] hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="report-post-reason"
                  checked={reason === c.value}
                  onChange={() => setReason(c.value)}
                  className="accent-[#00C8FF]"
                />
                <span className="font-medium text-[#F1F5F9]">{c.label}</span>
              </span>
              <span className="pl-6 text-xs text-[#94A3B8]">{c.description}</span>
            </label>
          ))}
        </div>

        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Additional details (optional)"
          rows={3}
          maxLength={1000}
          className="mt-3 w-full rounded-xl border border-[#1E3447] bg-[#0D1722] px-3 py-2 text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] resize-none"
        />

        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => reason && onSubmit(reason, details)}
            disabled={isLoading || !reason}
            className="flex-1 px-4 py-2 text-sm font-semibold rounded-xl transition disabled:opacity-50 bg-[#EF4444] text-white hover:bg-[#dc3737]"
          >
            {isLoading ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
