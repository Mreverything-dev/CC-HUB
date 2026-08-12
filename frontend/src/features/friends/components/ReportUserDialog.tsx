// frontend/src/features/friends/components/ReportUserDialog.tsx
import { useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ReportUserDialogProps {
  username: string;
  isLoading: boolean;
  onSubmit: (reason: string, details: string) => void;
  onCancel: () => void;
}

const REASONS = ['Spam', 'Harassment', 'Inappropriate content', 'Fake account', 'Other'];

export function ReportUserDialog({ username, isLoading, onSubmit, onCancel }: ReportUserDialogProps) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]"
      onClick={() => !isLoading && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center h-12 w-12 rounded-full mx-auto mb-4 border bg-[#EF4444]/10 border-[#EF4444]/30">
          <ExclamationTriangleIcon className="h-6 w-6 text-[#EF4444]" />
        </div>
        <h3 className="text-base font-semibold text-[#F1F5F9] text-center">Report {username}</h3>
        <p className="text-sm text-[#94A3B8] text-center mt-2">
          Let us know why you're reporting this user. Our team will review it.
        </p>

        <div className="mt-4 space-y-2">
          {REASONS.map((r) => (
            <label
              key={r}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm cursor-pointer transition ${
                reason === r
                  ? 'border-[#00C8FF]/50 bg-[#00C8FF]/10 text-[#F1F5F9]'
                  : 'border-[#1E3447] text-[#94A3B8] hover:border-[#1E3447] hover:bg-white/5'
              }`}
            >
              <input
                type="radio"
                name="report-reason"
                checked={reason === r}
                onChange={() => setReason(r)}
                className="accent-[#00C8FF]"
              />
              {r}
            </label>
          ))}
        </div>

        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Additional details (optional)"
          rows={3}
          maxLength={500}
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
            onClick={() => onSubmit(reason, details)}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-semibold rounded-xl transition disabled:opacity-50 bg-[#EF4444] text-white hover:bg-[#dc3737]"
          >
            {isLoading ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
