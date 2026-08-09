// frontend/src/features/announcements/components/AnnouncementCard.tsx
import { Announcement } from '@/types/announcement.types';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { formatDate } from '@/lib/formatters';

interface AnnouncementCardProps {
  announcement: Announcement;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onTogglePublish?: (id: string, isPublished: boolean) => void;
}

export function AnnouncementCard({ 
  announcement, 
  onEdit, 
  onDelete,
  onTogglePublish 
}: AnnouncementCardProps) {
  const { user } = useAuthStore();
  const isOwner = user?.id === announcement.user_id || user?.role === 'admin';

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'normal': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'emergency': return 'bg-red-200 text-red-900';
      case 'academic': return 'bg-yellow-100 text-yellow-800';
      case 'event': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-gray-900">
              {announcement.title}
            </h3>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(announcement.priority)}`}>
              {announcement.priority.toUpperCase()}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getTypeColor(announcement.type)}`}>
              {announcement.type}
            </span>
            {!announcement.is_published && (
              <span className="text-xs px-2 py-1 bg-gray-300 text-gray-700 rounded-full font-medium">
                DRAFT
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            By {announcement.created_by_role} • {formatDate(announcement.created_at)}
          </div>
        </div>
        
        {/* Actions - Only for owner/admin */}
        {isOwner && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTogglePublish?.(announcement.id, !announcement.is_published)}
              className={`text-sm px-3 py-1 rounded transition ${
                announcement.is_published 
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {announcement.is_published ? 'Unpublish' : 'Publish'}
            </button>
            <button
              onClick={() => onEdit?.(announcement.id)}
              className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete?.(announcement.id)}
              className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="text-gray-700 whitespace-pre-wrap mb-3">
        {announcement.content}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500 border-t pt-3">
        <span>Published: {formatDate(announcement.published_at)}</span>
        {announcement.expires_at && (
          <span>Expires: {formatDate(announcement.expires_at)}</span>
        )}
      </div>
    </div>
  );
}