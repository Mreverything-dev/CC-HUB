// frontend/src/features/chat/components/ChangeGroupLogoModal.tsx
import { useEffect, useRef, useState } from 'react';
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { mediaService } from '@/services/api/media.service';
import { chatApi } from '@/services/api/chat.service';
import { Conversation } from '@/types/chat.types';
import toast from 'react-hot-toast';

const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB

interface ChangeGroupLogoModalProps {
  conversation: Conversation;
  onClose: () => void;
  onUpdated: (conversation: Conversation) => void;
}

/**
 * Professor/Mayor/Officer-only group logo change - backend enforces the
 * same permission (see ChatService.can_edit_group_logo), this modal is only
 * ever opened for someone the frontend already knows is allowed. Reuses the
 * existing media upload endpoint (same as GoLiveModal's thumbnail, posts'
 * attachments, etc.) and the existing conversation-update API - no new
 * upload/storage system.
 */
export function ChangeGroupLogoModal({ conversation, onClose, onUpdated }: ChangeGroupLogoModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;

    if (!ALLOWED_LOGO_TYPES.includes(selected.type)) {
      setError('Only JPG, PNG, or WebP images are allowed.');
      return;
    }
    if (selected.size > MAX_LOGO_SIZE) {
      setError('Image must be smaller than 5MB.');
      return;
    }

    setError(null);
    setFile(selected);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(selected);
    });
  };

  const handleSave = async () => {
    if (!file) return;
    setIsSaving(true);
    try {
      const uploaded = await mediaService.uploadFiles([file]);
      const url = uploaded.urls[0];
      if (!url) throw new Error('Upload failed');
      const response = await chatApi.updateGroupLogo(conversation.id, url);
      onUpdated(response.data);
      toast.success('Group logo updated');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update group logo');
    } finally {
      setIsSaving(false);
    }
  };

  const displaySrc = preview || conversation.avatar_url || null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={() => !isSaving && onClose()}
    >
      <div
        className="bg-[#0D1722] w-full sm:max-w-sm sm:rounded-2xl border border-[#1E3447] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#1E3447]">
          <h3 className="font-semibold text-[#F1F5F9]">Change Group Logo</h3>
          <button
            onClick={() => !isSaving && onClose()}
            disabled={isSaving}
            className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-lg transition disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_LOGO_TYPES.join(',')}
            onChange={handleSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative mx-auto flex h-28 w-28 items-center justify-center rounded-full border-2 border-dashed border-[#1E3447] bg-[#111E2B] overflow-hidden hover:border-[#00C8FF]/40 transition"
          >
            {displaySrc ? (
              <img src={displaySrc} alt="Group logo preview" className="h-full w-full object-cover" />
            ) : (
              <PhotoIcon className="h-8 w-8 text-[#64748B]" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 group-hover:opacity-100 transition text-[11px] font-medium text-white">
              {displaySrc ? 'Change' : 'Upload'}
            </span>
          </button>
          {error && <p className="text-xs text-[#EF4444] text-center">{error}</p>}
          <p className="text-[11px] text-[#64748B] text-center">JPG, PNG, or WebP, up to 5MB.</p>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-[#1E3447]">
          <button
            onClick={() => !isSaving && onClose()}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!file || isSaving}
            className="px-6 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Logo'}
          </button>
        </div>
      </div>
    </div>
  );
}
