// frontend/src/features/announcements/components/CreateAnnouncement.tsx
import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  MegaphoneIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  ArrowDownIcon,
  MinusIcon,
  ArrowUpIcon,
  ExclamationCircleIcon,
  CheckIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSections } from '@/features/sections/hooks/useSections';
import { mediaService } from '@/services/api/media.service';
import { localInputToUtcIso } from '@/lib/formatters';
import { AnnouncementCreate } from '@/types/announcement.types';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

interface CreateAnnouncementProps {
  onClose: () => void;
  defaultSectionId?: string;
}

const TYPE_OPTIONS: { value: AnnouncementCreate['type']; label: string; icon: typeof MegaphoneIcon }[] = [
  { value: 'general', label: 'General', icon: MegaphoneIcon },
  { value: 'academic', label: 'Academic', icon: AcademicCapIcon },
  { value: 'event', label: 'Event', icon: CalendarDaysIcon },
  { value: 'emergency', label: 'Emergency', icon: ExclamationTriangleIcon },
];

const PRIORITY_OPTIONS: { value: AnnouncementCreate['priority']; label: string; icon: typeof ArrowDownIcon }[] = [
  { value: 'low', label: 'Low', icon: ArrowDownIcon },
  { value: 'normal', label: 'Normal', icon: MinusIcon },
  { value: 'high', label: 'High', icon: ArrowUpIcon },
  { value: 'urgent', label: 'Urgent', icon: ExclamationCircleIcon },
];

export function CreateAnnouncement({ onClose, defaultSectionId }: CreateAnnouncementProps) {
  const { createAnnouncement, isCreating } = useAnnouncements();
  const { user } = useAuthStore();
  const { sections, isLoading: sectionsLoading, refetch: refetchSections } = useSections();
  const [formData, setFormData] = useState<AnnouncementCreate>({
    title: '',
    content: '',
    type: 'general',
    priority: 'normal',
    is_published: true,
    expires_at: null,
    target_sections: defaultSectionId ? [defaultSectionId] : [],
  });
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Unsupported image type. Allowed: JPEG, PNG, GIF, WEBP, SVG.');
      return;
    }
    setError('');
    setImageFile(file);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  useEffect(() => {
    if (user?.role === 'professor' || user?.role === 'student') {
      refetchSections();
    }
  }, [user]);

  const officerSections = sections.filter((s) =>
    s.members?.some((m) => m.user_id === user?.id && (m.is_mayor || m.is_officer))
  );
  const isOfficer = user?.role === 'student' && officerSections.length > 0;

  if (!user || (user.role !== 'professor' && user.role !== 'admin' && !isOfficer)) {
    return null;
  }

  const postableSections = user.role === 'professor' ? sections : isOfficer ? officerSections : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if ((user.role === 'professor' || isOfficer) && postableSections.length === 0) {
      setError('You don\'t have any sections to post announcements to. Please create a section first.');
      return;
    }

    try {
      let uploadedImageUrl: string | null = formData.image_url ?? null;
      if (imageFile) {
        setIsUploadingImage(true);
        try {
          const uploaded = await mediaService.uploadFiles([imageFile]);
          uploadedImageUrl = uploaded.urls[0];
        } catch (uploadErr: any) {
          setError(uploadErr.response?.data?.detail || 'Failed to upload image');
          setIsUploadingImage(false);
          return;
        }
        setIsUploadingImage(false);
      }

      const announcementData = {
        ...formData,
        image_url: uploadedImageUrl,
        expires_at: formData.expires_at ? localInputToUtcIso(formData.expires_at) : null,
        target_sections: (user.role === 'professor' || isOfficer) && (formData.target_sections?.length ?? 0) === 0
          ? postableSections.map(s => s.id)
          : formData.target_sections,
      };

      await createAnnouncement(announcementData);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create announcement');
    }
  };

  const handleSectionToggle = (sectionId: string) => {
    setFormData(prev => {
      const current = prev.target_sections || [];
      if (current.includes(sectionId)) {
        return { ...prev, target_sections: current.filter(id => id !== sectionId) };
      } else {
        return { ...prev, target_sections: [...current, sectionId] };
      }
    });
  };

  const selectAllSections = () => {
    if (postableSections.length > 0) {
      setFormData(prev => ({ ...prev, target_sections: postableSections.map(s => s.id) }));
    }
  };

  const deselectAllSections = () => {
    setFormData(prev => ({ ...prev, target_sections: [] }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md rounded-2xl border border-border bg-bg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Create Announcement</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              {user.role === 'admin'
                ? 'Share an update with everyone'
                : isOfficer
                ? 'Share an update with your section'
                : 'Share updates with your students'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-secondary hover:text-text-primary rounded-lg hover:bg-glass transition"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-2 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444] text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3 max-h-[70vh] overflow-y-auto themed-scrollbar">
          {/* Title */}
          <div>
            <label htmlFor="announcement-title" className="block text-[11px] font-medium text-text-secondary mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id="announcement-title"
              name="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-glass text-xs text-text-primary placeholder-text-muted focus:ring-1 focus:ring-border focus:border-border focus:outline-none transition"
              placeholder="Announcement title"
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor="announcement-content" className="block text-[11px] font-medium text-text-secondary mb-1">
              Content <span className="text-red-400">*</span>
            </label>
            <textarea
              id="announcement-content"
              name="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
              rows={3}
              className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-glass text-xs text-text-primary placeholder-text-muted focus:ring-1 focus:ring-border focus:border-border focus:outline-none transition resize-none"
              placeholder="Write your announcement..."
            />
          </div>

          {/* Type + Priority — side by side dropdowns */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as AnnouncementCreate['type'] })}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-glass text-xs text-text-primary focus:ring-1 focus:ring-border focus:border-border focus:outline-none transition"
              >
                {TYPE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as AnnouncementCreate['priority'] })}
                className="w-full px-2 py-1.5 rounded-lg border border-border bg-glass text-xs text-text-primary focus:ring-1 focus:ring-border focus:border-border focus:outline-none transition"
              >
                {PRIORITY_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Image upload — compact */}
          <div>
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border border-border bg-bg">
                <img src={imagePreview} alt="Preview" className="w-full max-h-32 object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  title="Remove image"
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label
                htmlFor="announcement-image"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-glass py-2 text-[11px] text-text-muted hover:border-text-primary/30 hover:text-text-secondary cursor-pointer transition"
              >
                <PhotoIcon className="h-3.5 w-3.5" />
                Attach image (optional)
                <input
                  id="announcement-image"
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Publish toggle + Expiry inline */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_published}
                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-border bg-bg text-text-primary focus:ring-text-primary focus:ring-offset-0"
              />
              Publish now
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="announcement-expires-date"
                type="date"
                value={formData.expires_at?.split('T')[0] ?? ''}
                onChange={(e) => {
                  const date = e.target.value;
                  const time = formData.expires_at?.split('T')[1] || '23:59';
                  setFormData({ ...formData, expires_at: date ? `${date}T${time}` : null });
                }}
                title="Expires date"
                className="px-2 py-1 rounded-lg border border-border bg-glass text-[11px] text-text-secondary focus:ring-1 focus:ring-border focus:border-border focus:outline-none transition [color-scheme:light] dark:[color-scheme:dark]"
              />
              <input
                id="announcement-expires-time"
                type="time"
                value={formData.expires_at?.split('T')[1] ?? ''}
                onChange={(e) => {
                  const time = e.target.value;
                  const date = formData.expires_at?.split('T')[0] || new Date().toISOString().split('T')[0];
                  setFormData({ ...formData, expires_at: time ? `${date}T${time}` : null });
                }}
                title="Expires time"
                className="px-2 py-1 rounded-lg border border-border bg-glass text-[11px] text-text-secondary focus:ring-1 focus:ring-border focus:border-border focus:outline-none transition [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          </div>

          {/* Section selector — collapsible */}
          {(user.role === 'professor' || isOfficer) && (
            <details className="rounded-lg border border-border bg-glass">
              <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-text-secondary hover:text-text-primary transition select-none">
                Target Sections ({formData.target_sections?.length || 'All'})
              </summary>
              <div className="px-3 pb-3 pt-1 space-y-2">
                <div className="flex items-center gap-2 text-[11px]">
                  <button type="button" onClick={selectAllSections} className="text-text-primary hover:underline transition">
                    Select All
                  </button>
                  <span className="text-border">|</span>
                  <button type="button" onClick={deselectAllSections} className="text-text-muted hover:text-text-primary transition">
                    Deselect
                  </button>
                </div>
                {sectionsLoading ? (
                  <p className="text-[11px] text-text-muted py-1">Loading...</p>
                ) : postableSections.length === 0 ? (
                  <p className="text-[11px] text-amber-400">No sections available.</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto themed-scrollbar">
                    {postableSections.map((section) => {
                      const isSelected = (formData.target_sections || []).includes(section.id);
                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => handleSectionToggle(section.id)}
                          className={`w-full flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                            isSelected
                              ? 'border-text-primary/50 bg-text-primary/5'
                              : 'border-border bg-bg hover:border-text-primary/30'
                          }`}
                        >
                          <span className="h-6 w-6 flex-shrink-0 rounded-md bg-border flex items-center justify-center text-[9px] font-bold text-text-primary">
                            {section.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="text-[11px] text-text-primary truncate flex-1">{section.name}</span>
                          <span
                            className={`flex-shrink-0 h-3.5 w-3.5 rounded border flex items-center justify-center ${
                              isSelected ? 'bg-text-primary border-text-primary' : 'border-border'
                            }`}
                          >
                            {isSelected && <CheckIcon className="h-2.5 w-2.5 text-bg" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Admin note */}
          {user.role === 'admin' && (
            <p className="text-[11px] text-text-muted bg-glass border border-border p-2 rounded-lg">
              Visible to ALL users.
            </p>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-glass rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || isUploadingImage}
              className="px-4 py-1.5 text-xs font-semibold border border-border bg-glass text-text-primary rounded-lg hover:bg-glass-hover transition disabled:opacity-50"
            >
              {isUploadingImage ? 'Uploading...' : isCreating ? 'Creating...' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}