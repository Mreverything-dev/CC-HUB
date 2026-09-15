// frontend/src/features/friends/components/NotificationBell.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRelativeTime } from '@/lib/formatters';
import { useFriends } from '../hooks/useFriends';
import { BellIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { ViolationDetailsModal } from '@/features/posts/components/ViolationDetailsModal';

interface NotificationBellProps {
  onNavigateFriends?: () => void;
}

export default function NotificationBell({ onNavigateFriends }: NotificationBellProps = {}) {
  const navigate = useNavigate();
  const {
    notifications,
    unreadNotifications,
    isLoadingNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useFriends();
  const [isOpen, setIsOpen] = useState(false);
  const [violationReportId, setViolationReportId] = useState<string | null>(null);

  const handleNotificationClick = (id: string, isRead: boolean, type: string, data: any) => {
    if (!isRead) {
      markNotificationRead(id);
    }
    setIsOpen(false);
    if (type === 'friend_request' || type === 'friend_accepted') {
      if (onNavigateFriends) {
        onNavigateFriends();
      } else {
        navigate('/friends');
      }
    } else if (type === 'announcement' && data?.announcement_id) {
      navigate(`/announcements/${data.announcement_id}`);
    } else if (type === 'post_violation' && data?.report_id) {
      setViolationReportId(data.report_id);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-secondary hover:text-text-primary transition-all duration-200 rounded-xl hover:scale-110 active:scale-95"
        title="Notifications"
      >
        <BellIcon className="h-5 w-5" />
        {unreadNotifications > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#EF4444] text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center leading-none">
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 w-auto sm:w-80 bg-bg rounded-2xl shadow-2xl border border-border z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-text-primary">Notifications</h3>
              {unreadNotifications > 0 && (
                <button
                  onClick={() => markAllNotificationsRead()}
                  className="text-xs text-text-primary hover:underline font-medium transition"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto themed-scrollbar">
              {isLoadingNotifications ? (
                <div className="p-3 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-2.5 animate-pulse">
                      <div className="h-8 w-8 rounded-full bg-glass flex-shrink-0" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-3 rounded bg-glass w-3/4" />
                        <div className="h-3 rounded bg-glass w-1/2" />
                        <div className="h-2 rounded bg-glass w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">No notifications yet.</p>
              ) : (
                notifications.map((n) => {
                  const actorAvatar = n.data?.actor_avatar as string | null | undefined;
                  const actorName = n.data?.actor_name as string | undefined;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id, n.is_read, n.type, n.data)}
                      className={`w-full text-left px-4 py-3 border-b border-border hover:bg-glass transition ${
                        !n.is_read ? 'bg-text-primary/[0.04]' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="relative flex-shrink-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${
                              n.type === 'post_violation' || n.type === 'moderation_warning' || n.type === 'moderation_restriction'
                                ? 'bg-[#EF4444]/15'
                                : 'bg-border'
                            }`}
                          >
                            {n.type === 'post_violation' || n.type === 'moderation_warning' || n.type === 'moderation_restriction' ? (
                              <ExclamationTriangleIcon className="h-4 w-4 text-[#EF4444]" />
                            ) : actorAvatar ? (
                              <img src={actorAvatar} alt={actorName || ''} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-text-secondary text-xs font-semibold">
                                {actorName?.charAt(0).toUpperCase() || 'C'}
                              </span>
                            )}
                          </div>
                          {!n.is_read && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-text-primary border-2 border-bg" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary">{n.title}</p>
                          {n.content && (
                            <p className="text-sm text-text-secondary">{n.content}</p>
                          )}
                          <p className="text-xs text-text-muted mt-1">
                            {formatRelativeTime(n.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {violationReportId && (
        <ViolationDetailsModal reportId={violationReportId} onClose={() => setViolationReportId(null)} />
      )}
    </div>
  );
}