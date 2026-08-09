// frontend/src/features/announcements/components/CreateAnnouncement.tsx
import { useState, useEffect } from 'react';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSections } from '@/features/sections/hooks/useSections';
import { AnnouncementCreate } from '@/types/announcement.types';

interface CreateAnnouncementProps {
  onClose: () => void;
}

export function CreateAnnouncement({ onClose }: CreateAnnouncementProps) {
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
    target_sections: [],
  });
  const [error, setError] = useState('');

  // ✅ Fetch sections on mount
  useEffect(() => {
    if (user?.role === 'professor') {
      refetchSections();
    }
  }, [user]);

  // ✅ Only professors and admins can create announcements
  if (!user || (user.role !== 'professor' && user.role !== 'admin')) {
    return null;
  }

  // ✅ Get professor's sections
  const professorSections = user.role === 'professor' ? sections : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // ✅ Validate professor has sections
    if (user.role === 'professor' && professorSections.length === 0) {
      setError('You don\'t have any sections to post announcements to. Please create a section first.');
      return;
    }

    try {
      // ✅ For professors, target_sections must be set
      const announcementData = {
        ...formData,
        expires_at: formData.expires_at || null,
        // ✅ If no sections selected, target ALL sections
        target_sections: user.role === 'professor' && formData.target_sections?.length === 0
          ? professorSections.map(s => s.id)
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
    if (professorSections.length > 0) {
      setFormData(prev => ({
        ...prev,
        target_sections: professorSections.map(s => s.id)
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Create Announcement</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="announcement-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              id="announcement-title"
              name="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter announcement title"
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor="announcement-content" className="block text-sm font-medium text-gray-700 mb-1">
              Content *
            </label>
            <textarea
              id="announcement-content"
              name="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter announcement content"
            />
          </div>

          {/* Type & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="announcement-type" className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                id="announcement-type"
                name="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as AnnouncementCreate['type'] })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="general">General</option>
                <option value="academic">Academic</option>
                <option value="event">Event</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            <div>
              <label htmlFor="announcement-priority" className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                id="announcement-priority"
                name="priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as AnnouncementCreate['priority'] })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Publish & Expiry */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <input
                  type="checkbox"
                  checked={formData.is_published}
                  onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                  className="mr-2"
                />
                Publish immediately
              </label>
            </div>

            <div>
              <label htmlFor="announcement-expires-at" className="block text-sm font-medium text-gray-700 mb-1">
                Expires At (Optional)
              </label>
              <input
                id="announcement-expires-at"
                name="expires_at"
                type="datetime-local"
                value={formData.expires_at ?? ''}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value || null })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* ✅ Section Selection for Professors */}
          {user.role === 'professor' && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Target Sections
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllSections}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAllSections}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {sectionsLoading ? (
                <p className="text-sm text-gray-500">Loading sections...</p>
              ) : professorSections.length === 0 ? (
                <p className="text-sm text-yellow-600">
                  ⚠️ You don't have any sections yet. Create a section first.
                </p>
              ) : (
                <div className="space-y-2">
                  {professorSections.map((section) => (
                    <label key={section.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={(formData.target_sections || []).includes(section.id)}
                        onChange={() => handleSectionToggle(section.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">
                        {section.name}
                        {section.course && <span className="text-gray-400 ml-1">({section.course})</span>}
                      </span>
                      {section.member_count !== undefined && (
                        <span className="text-gray-400 text-xs ml-auto">
                          {section.member_count} students
                        </span>
                      )}
                    </label>
                  ))}
                  <p className="text-xs text-gray-400 mt-2">
                    {formData.target_sections?.length === 0 || !formData.target_sections?.length
                      ? 'ℹ️ No sections selected - announcement will go to ALL your sections'
                      : `✅ ${formData.target_sections.length} section(s) selected`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Admin Note */}
          {user.role === 'admin' && (
            <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg">
              ℹ️ Admin announcements are visible to ALL users.
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}