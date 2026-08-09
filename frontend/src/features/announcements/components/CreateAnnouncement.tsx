// frontend/src/features/announcements/components/CreateAnnouncement.tsx
import { useState } from 'react';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { AnnouncementCreate } from '@/types/announcement.types';

interface CreateAnnouncementProps {
  onClose: () => void;
}

export function CreateAnnouncement({ onClose }: CreateAnnouncementProps) {
  const { createAnnouncement, isCreating } = useAnnouncements();
  const { user } = useAuthStore();
  const [formData, setFormData] = useState<AnnouncementCreate>({
    title: '',
    content: '',
    type: 'general',
    priority: 'normal',
    is_published: true,
    expires_at: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAnnouncement({
      ...formData,
      expires_at: formData.expires_at || null,
    });
    onClose();
  };

  // Only professors and admins can create announcements
  if (!user || (user.role !== 'professor' && user.role !== 'admin')) {
    return null;
  }

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

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="announcement-is-published" className="block text-sm font-medium text-gray-700 mb-1">
                <input
                  id="announcement-is-published"
                  name="is_published"
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
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

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