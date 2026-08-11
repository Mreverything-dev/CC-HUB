// frontend/src/features/friends/components/NotificationBell.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useFriends } from '../hooks/useFriends';
import { BellIcon } from '@heroicons/react/24/outline';

export default function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useFriends();
  const [isOpen, setIsOpen] = useState(false);

  const handleNotificationClick = (id: string, isRead: boolean, type: string) => {
    if (!isRead) {
      markNotificationRead(id);
    }
    setIsOpen(false);
    if (type === 'friend_request' || type === 'friend_accepted') {
      navigate('/friends');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-cyan-500 transition rounded-full hover:bg-cyan-500/10"
        title="Notifications"
      >
        <BellIcon className="h-6 w-6" />
        {unreadNotifications > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-100 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              {unreadNotifications > 0 && (
                <button
                  onClick={() => markAllNotificationsRead()}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n.id, n.is_read, n.type)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition ${
                      !n.is_read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read && (
                        <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                      )}
                      <div className={n.is_read ? 'ml-4' : ''}>
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        {n.content && (
                          <p className="text-sm text-gray-500">{n.content}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
