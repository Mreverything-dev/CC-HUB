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
import { AnnouncementCreate } from '@/types/announcement.types';

// Keep in sync with backend ALLOWED_TYPES in app/api/v1/endpoints/media.py (images only here)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

interface CreateAnnouncementProps {
  onClose: () => void;
  /** Pre-select a single target section (e.g. opened from that section's own
   * management view) instead of defaulting to every section the user can post to. */
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

const inputClassName =
  'w-full px-3 py-2 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] text-sm text-white placeholder-[#6b6b6b] focus:ring-1 focus:ring-[#00d4ff] focus:border-[#00d4ff] focus:outline-none transition';

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

  // ✅ Clean up the object URL preview when it changes/unmounts
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

  // ✅ Fetch sections on mount (professors need their advised sections,
  // students need their memberships to determine mayor/officer status)
  useEffect(() => {
    if (user?.role === 'professor' || user?.role === 'student') {
      refetchSections();
    }
  }, [user]);

  // ✅ Sections where the current user holds a mayor/officer position -
  // the only sections a student is allowed to post to
  const officerSections = sections.filter((s) =>
    s.members?.some((m) => m.user_id === user?.id && (m.is_mayor || m.is_officer))
  );
  const isOfficer = user?.role === 'student' && officerSections.length > 0;

  // ✅ Professors, admins, and section mayors/officers can create announcements
  if (!user || (user.role !== 'professor' && user.role !== 'admin' && !isOfficer)) {
    return null;
  }

  // ✅ Sections this user is allowed to post to
  const postableSections = user.role === 'professor' ? sections : isOfficer ? officerSections : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // ✅ Validate professor/officer has sections
    if ((user.role === 'professor' || isOfficer) && postableSections.length === 0) {
      setError('You don\'t have any sections to post announcements to. Please create a section first.');
      return;
    }

    try {
      // ✅ Upload the image first (if one was selected) so we have a URL to attach
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

      // ✅ For professors/officers, target_sections must be set
      const announcementData = {
        ...formData,
        image_url: uploadedImageUrl,
        expires_at: formData.expires_at || null,
        // ✅ If no sections selected, target ALL postable sections
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
      setFormData(prev => ({
        ...prev,
        target_sections: postableSections.map(s => s.id)
      }));
    }
  };

  const deselectAllSections = () => {
    setFormData(prev => ({
      ...prev,
      target_sections: []
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2a2a] bg-[#141414] shadow-2xl themed-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-lg font-bold text-white">Create Announcement</h2>
            <p className="text-xs text-[#6b6b6b] mt-0.5">
              {user.role === 'admin'
                ? 'Share an update with everyone'
                : isOfficer
                ? 'Share an update with your section'
                : 'Share important updates with your students'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#a0a0a0] hover:text-white rounded-full hover:bg-white/5 transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label htmlFor="announcement-title" className="block text-sm font-medium text-[#a0a0a0] mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id="announcement-title"
              name="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className={inputClassName}
              placeholder="Enter announcement title"
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor="announcement-content" className="block text-sm font-medium text-[#a0a0a0] mb-1.5">
              Content <span className="text-red-400">*</span>
            </label>
            <textarea
              id="announcement-content"
              name="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
              rows={6}
              className={`${inputClassName} resize-none`}
              placeholder="Write your announcement content here..."
            />
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-[#a0a0a0] mb-1.5">Image (Optional)</label>
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0f0f0f]">
                <img src={imagePreview} alt="Announcement attachment preview" className="w-full max-h-64 object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  title="Remove image"
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label
                htmlFor="announcement-image"
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#2a2a2a] bg-[#0f0f0f] py-6 text-sm text-[#6b6b6b] hover:border-[#3a3a3a] hover:text-[#a0a0a0] cursor-pointer transition"
              >
                <PhotoIcon className="h-5 w-5" />
                Click to attach an image
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

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-[#a0a0a0] mb-1.5">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => {
                const isActive = formData.type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: value })}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition ${
                      isActive
                        ? 'border-[#00d4ff]/50 bg-[#00d4ff]/10 text-[#00d4ff]'
                        : 'border-[#2a2a2a] bg-[#0f0f0f] text-[#a0a0a0] hover:border-[#3a3a3a] hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-[#a0a0a0] mb-1.5">Priority</label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITY_OPTIONS.map(({ value, label, icon: Icon }) => {
                const isActive = formData.priority === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: value })}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition ${
                      isActive
                        ? 'border-[#00d4ff]/50 bg-[#00d4ff]/10 text-[#00d4ff]'
                        : 'border-[#2a2a2a] bg-[#0f0f0f] text-[#a0a0a0] hover:border-[#3a3a3a] hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Publish & Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-[#a0a0a0] cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_published}
                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                className="h-4 w-4 rounded border-[#2a2a2a] bg-[#0f0f0f] text-[#00d4ff] focus:ring-[#00d4ff] focus:ring-offset-0"
              />
              Publish immediately
            </label>

            <div>
              <label htmlFor="announcement-expires-at" className="block text-sm font-medium text-[#a0a0a0] mb-1.5">
                Expires At (Optional)
              </label>
              <input
                id="announcement-expires-at"
                name="expires_at"
                type="datetime-local"
                value={formData.expires_at ?? ''}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value || null })}
                className={`${inputClassName} [color-scheme:dark]`}
              />
            </div>
          </div>

          {/* ✅ Section Selection for Professors and section mayors/officers */}
          {(user.role === 'professor' || isOfficer) && (
            <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f]/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-[#a0a0a0]">
                  Target Sections
                </label>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAllSections}
                    className="text-[#00d4ff] hover:text-white transition"
                  >
                    Select All
                  </button>
                  <span className="text-[#2a2a2a]">|</span>
                  <button
                    type="button"
                    onClick={deselectAllSections}
                    className="text-[#6b6b6b] hover:text-white transition"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {sectionsLoading ? (
                <p className="text-sm text-[#6b6b6b] py-2">Loading sections...</p>
              ) : postableSections.length === 0 ? (
                <p className="text-sm text-amber-400">
                  You don't have any sections yet. Create a section first.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {postableSections.map((section) => {
                      const isSelected = (formData.target_sections || []).includes(section.id);
                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => handleSectionToggle(section.id)}
                          className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                            isSelected
                              ? 'border-[#00d4ff]/50 bg-[#00d4ff]/5'
                              : 'border-[#2a2a2a] bg-[#0f0f0f] hover:border-[#3a3a3a]'
                          }`}
                        >
                          <span className="h-9 w-9 flex-shrink-0 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#0099cc] flex items-center justify-center text-xs font-bold text-[#0a0a0a]">
                            {section.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate">{section.name}</p>
                            {section.course && (
                              <p className="text-xs text-[#6b6b6b] truncate">{section.course}</p>
                            )}
                          </div>
                          {section.member_count !== undefined && (
                            <span className="flex-shrink-0 text-[10px] font-semibold text-[#a0a0a0] bg-white/5 border border-[#2a2a2a] rounded-full px-2 py-0.5">
                              {section.member_count} students
                            </span>
                          )}
                          <span
                            className={`flex-shrink-0 h-4 w-4 rounded border flex items-center justify-center ${
                              isSelected ? 'bg-[#00d4ff] border-[#00d4ff]' : 'border-[#3a3a3a]'
                            }`}
                          >
                            {isSelected && <CheckIcon className="h-3 w-3 text-[#0a0a0a]" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-[#6b6b6b] mt-2">
                    {formData.target_sections?.length === 0 || !formData.target_sections?.length
                      ? 'No sections selected - announcement will go to ALL your sections'
                      : `${formData.target_sections.length} section(s) selected`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Admin Note */}
          {user.role === 'admin' && (
            <div className="text-sm text-[#a0a0a0] bg-[#00d4ff]/5 border border-[#00d4ff]/20 p-3 rounded-xl">
              Admin announcements are visible to ALL users.
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2a2a2a]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#a0a0a0] hover:text-white hover:bg-white/5 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || isUploadingImage}
              className="px-6 py-2 text-sm font-semibold bg-gradient-to-br from-[#00d4ff] to-[#0099cc] text-[#0a0a0a] rounded-xl hover:opacity-90 transition disabled:opacity-50"
            >
              {isUploadingImage ? 'Uploading image...' : isCreating ? 'Creating...' : 'Create Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
