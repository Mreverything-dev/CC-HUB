// frontend/src/components/ui/ConfirmDialog.tsx
import { ReactNode } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  /** Text shown on the confirm button while isLoading is true - defaults to
   * "Please wait..." so every existing caller keeps its current wording. */
  loadingLabel?: string;
  /** Red/destructive styling by default - pass false for a neutral cyan confirmation. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable themed confirmation modal for destructive/important actions,
 * replacing native window.confirm() popups. Shared across features (section
 * deletion, member removal, etc.) instead of duplicating the modal shell.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isLoading = false,
  loadingLabel = 'Please wait...',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]"
      onClick={() => !isLoading && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-center h-12 w-12 rounded-full mx-auto mb-4 border ${
            danger
              ? 'bg-[#EF4444]/10 border-[#EF4444]/30'
              : 'bg-[#00C8FF]/10 border-[#00C8FF]/30'
          }`}
        >
          <ExclamationTriangleIcon className={`h-6 w-6 ${danger ? 'text-[#EF4444]' : 'text-[#00C8FF]'}`} />
        </div>
        <h3 className="text-base font-semibold text-[#F1F5F9] text-center">{title}</h3>
        <div className="text-sm text-[#94A3B8] text-center mt-2">{message}</div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-xl transition disabled:opacity-50 ${
              danger
                ? 'bg-[#EF4444] text-white hover:bg-[#dc3737]'
                : 'bg-[#00C8FF] text-[#060B12] hover:opacity-90'
            }`}
          >
            {isLoading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
