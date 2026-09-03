// frontend/src/features/dashboard/components/admin/announcements/EditAnnouncementModal.tsx
import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { announcementApi } from '@/services/api/announcement.service';
import { AdminAnnouncementListItem } from '@/services/api/admin.service';
import toast from 'react-hot-toast';

const inputClassName =
  'w-full px-3 py-2 rounded-xl border border-[#1E3447] bg-[#0A111A] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none transition';

const TYPE_OPTIONS = ['general', 'academic', 'event', 'emergency'] as const;
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'] as const;

interface EditAnnouncementModalProps {
  announcement: AdminAnnouncementListItem;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Title/content/type/priority only - editing WHO an announcement targets
 * is left to the full Create Announcement flow (its section picker already
 * enforces mayor/officer/professor targeting rules); this admin quick-edit
 * doesn't touch AnnouncementTarget rows at all, so it can't accidentally
 * bypass those already-audited restrictions.
 */
export function EditAnnouncementModal({ announcement, onClose, onSaved }: EditAnnouncementModalProps) {
  const [title, setTitle] = useState(announcement.title);
  const [content, setContent] = useState(announcement.content);
  const [type, setType] = useState(announcement.type);
  const [priority, setPriority] = useState(announcement.priority);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required.');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      await announcementApi.updateAnnouncement(announcement.id, {
        title: title.trim(),
        content: content.trim(),
        type: type as any,
        priority: priority as any,
      });
      toast.success('Announcement updated');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update announcement');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1E3447]">
          <h2 className="text-lg font-bold text-[#F1F5F9]">Edit Announcement</h2>
          <button onClick={onClose} className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] rounded-full hover:bg-white/5 transition">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClassName} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Content</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} className={`${inputClassName} resize-none`} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputClassName}>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClassName}>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
