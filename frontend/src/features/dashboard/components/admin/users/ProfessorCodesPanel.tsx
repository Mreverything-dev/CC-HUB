// frontend/src/features/dashboard/components/admin/users/ProfessorCodesPanel.tsx
import { useState } from 'react';
import { ClipboardDocumentIcon, TrashIcon, KeyIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/formatters';
import { useProfessorCodes } from '../../../hooks/useProfessorCodes';
import { ProfessorCodeResponse } from '@/services/api/admin.service';

export function ProfessorCodesPanel() {
  const { codes, isLoading, deleteCode } = useProfessorCodes();
  const [expanded, setExpanded] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ProfessorCodeResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteCode(deleteTarget.code);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5"
      >
        <div className="flex items-center gap-2">
          <KeyIcon className="h-4 w-4 text-[#00C8FF]" />
          <span className="text-sm font-semibold text-[#F1F5F9]">Active Professor Codes</span>
          {codes.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-[#00C8FF]/10 text-[#00C8FF] border border-[#00C8FF]/30">
              {codes.length}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUpIcon className="h-4 w-4 text-[#64748B]" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-[#64748B]" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[#1E3447]">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-8 rounded-lg bg-[#1E3447] animate-pulse" />
              ))}
            </div>
          ) : codes.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#64748B] text-center">
              No active professor codes. Generate one to invite a professor.
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#1E3447]">
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Code</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Status</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Expires</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Created</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#64748B] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((c) => (
                      <tr key={c.code} className="border-b border-[#1E3447] last:border-0 hover:bg-white/[0.03] transition">
                        <td className="px-4 py-2.5 text-sm font-mono text-[#F1F5F9]">{c.code}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30">
                            Active
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-[#94A3B8]">{formatAbsoluteTime(c.expires_at)}</td>
                        <td className="px-4 py-2.5 text-sm text-[#94A3B8]">{formatRelativeTime(c.created_at)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleCopy(c.code)}
                              title="Copy code"
                              className="p-1.5 text-[#64748B] hover:text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-lg transition"
                            >
                              <ClipboardDocumentIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(c)}
                              title="Delete code"
                              className="p-1.5 text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-[#1E3447]">
                {codes.map((c) => (
                  <div key={c.code} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-mono text-[#F1F5F9]">{c.code}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-1.5">Expires {formatAbsoluteTime(c.expires_at)}</p>
                    <p className="text-xs text-[#64748B]">Created {formatRelativeTime(c.created_at)}</p>
                    <div className="flex items-center gap-2 mt-2.5">
                      <button
                        onClick={() => handleCopy(c.code)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E3447] text-xs font-medium text-[#94A3B8] hover:text-[#00C8FF] hover:border-[#00C8FF]/30 transition"
                      >
                        <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                        Copy
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E3447] text-xs font-medium text-[#94A3B8] hover:text-[#EF4444] hover:border-[#EF4444]/30 transition"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this professor code?"
          message={`${deleteTarget.code} will be permanently revoked and can no longer be used to register a professor account.`}
          confirmLabel="Delete"
          danger
          isLoading={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
