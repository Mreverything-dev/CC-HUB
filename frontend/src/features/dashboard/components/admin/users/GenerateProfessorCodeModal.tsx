// frontend/src/features/dashboard/components/admin/users/GenerateProfessorCodeModal.tsx
import { useState } from 'react';
import { XMarkIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { formatAbsoluteTime } from '@/lib/formatters';
import { useProfessorCodes } from '../../../hooks/useProfessorCodes';
import { ProfessorCodeValidity, ProfessorCodeResponse } from '@/services/api/admin.service';

interface GenerateProfessorCodeModalProps {
  onClose: () => void;
}

const VALIDITY_OPTIONS: { value: ProfessorCodeValidity; label: string }[] = [
  { value: '1h', label: '1 Hour' },
  { value: '1d', label: '1 Day' },
  { value: '1w', label: '1 Week' },
];

export default function GenerateProfessorCodeModal({ onClose }: GenerateProfessorCodeModalProps) {
  const { generateCode, isGenerating } = useProfessorCodes();
  const [validity, setValidity] = useState<ProfessorCodeValidity>('1d');
  const [generated, setGenerated] = useState<ProfessorCodeResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setError('');
    try {
      const response = await generateCode(validity);
      setGenerated(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate code');
    }
  };

  const handleCopy = () => {
    if (!generated) return;
    navigator.clipboard.writeText(generated.code);
    setCopied(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="w-full max-w-sm rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#F1F5F9]">Generate Professor Code</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-full transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444] text-sm">
            {error}
          </div>
        )}

        {generated ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-2">
              Professor Registration Code
            </p>
            <div className="rounded-xl border border-[#00C8FF]/30 bg-[#00C8FF]/5 p-4 text-center">
              <p className="text-xl font-mono font-bold tracking-wider text-[#00C8FF]">{generated.code}</p>
            </div>
            <p className="text-xs text-[#64748B] mt-3">
              Expires: <span className="text-[#F1F5F9]">{formatAbsoluteTime(generated.expires_at)}</span>
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              This code can only be used once, for one professor account.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-[#1E3447]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-6 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition"
              >
                {copied ? <CheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy Code'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-[#94A3B8] mb-2">Validity</p>
            <div className="space-y-2">
              {VALIDITY_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition ${
                    validity === value
                      ? 'border-[#00C8FF]/50 bg-[#00C8FF]/5'
                      : 'border-[#1E3447] bg-[#0A111A] hover:border-[#00C8FF]/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="validity"
                    checked={validity === value}
                    onChange={() => setValidity(value)}
                    className="h-4 w-4 text-[#00C8FF] focus:ring-[#00C8FF] focus:ring-offset-0"
                  />
                  <span className="text-sm text-[#F1F5F9]">{label}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-[#1E3447]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-6 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : 'Generate Code'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
