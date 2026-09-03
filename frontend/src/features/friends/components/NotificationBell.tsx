// frontend/src/features/friends/components/NotificationBell.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRelativeTime } from '@/lib/formatters';
import { useFriends } from '../hooks/useFriends';
import { BellIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { ViolationDetailsModal } from '@/features/posts/components/ViolationDetailsModal';

interface NotificationBellProps {
  /** When provided (e.g. inside a Sidebar-based dashboard), friend-related
   * notifications open the in-dashboard Friends section instead of
   * navigating away to the standalone /friends page. */
  onNavigateFriends?: () => void;
}

export default function NotificationBell({ onNavigateFriends }: NotificationBellProps = {}) {
  const navigate = useNavigate();
  const {
    notifications,
    unreadNotifications,
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
        className="relative p-2 text-[#94A3B8] hover:text-[#00C8FF] transition rounded-xl hover:bg-white/5"
        title="Notifications"
      >
        <BellIcon className="h-5 w-5" />
        {unreadNotifications > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-[#00C8FF] text-[#060B12] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Anchored to the viewport (not the bell button) below sm: - the
              bell sits well left of the screen's right edge on mobile (other
              action buttons/avatar follow it), so a dropdown anchored via
              `right-0` to the button itself, at a fixed 320px width, was
              extending past the left edge of the screen and causing
              horizontal overflow on narrow phones. */}
          <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 w-auto sm:w-80 bg-[#0D1722] rounded-2xl shadow-2xl border border-[#1E3447] z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1E3447] flex items-center justify-between">
              <h3 className="font-semibold text-[#F1F5F9]">Notifications</h3>
              {unreadNotifications > 0 && (
                <button
                  onClick={() => markAllNotificationsRead()}
                  className="text-xs text-[#00C8FF] hover:text-[#00E0FF] font-medium transition"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto themed-scrollbar">
              {notifications.length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-8">No notifications yet.</p>
              ) : (
                notifications.map((n) => {
                  const actorAvatar = n.data?.actor_avatar as string | null | undefined;
                  const actorName = n.data?.actor_name as string | undefined;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id, n.is_read, n.type, n.data)}
                      className={`w-full text-left px-4 py-3 border-b border-[#1E3447] hover:bg-white/5 transition ${
                        !n.is_read ? 'bg-[#00C8FF]/[0.06]' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="relative flex-shrink-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${
                              n.type === 'post_violation' || n.type === 'moderation_warning' || n.type === 'moderation_restriction'
                                ? 'bg-[#EF4444]/15'
                                : 'bg-[#1E3447]'
                            }`}
                          >
                            {n.type === 'post_violation' || n.type === 'moderation_warning' || n.type === 'moderation_restriction' ? (
                              <ExclamationTriangleIcon className="h-4 w-4 text-[#EF4444]" />
                            ) : actorAvatar ? (
                              <img src={actorAvatar} alt={actorName || ''} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[#94A3B8] text-xs font-semibold">
                                {actorName?.charAt(0).toUpperCase() || 'C'}
                              </span>
                            )}
                          </div>
                          {!n.is_read && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#00C8FF] border-2 border-[#0D1722]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#F1F5F9]">{n.title}</p>
                          {n.content && (
                            <p className="text-sm text-[#94A3B8]">{n.content}</p>
                          )}
                          <p className="text-xs text-[#64748B] mt-1">
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
