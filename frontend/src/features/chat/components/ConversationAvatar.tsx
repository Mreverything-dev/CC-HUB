// frontend/src/features/chat/components/ConversationAvatar.tsx
import { Avatar } from '@/features/dashboard/components/Avatar';
import { Conversation } from '@/types/chat.types';

interface ConversationAvatarProps {
  conversation: Conversation;
  currentUserId?: string;
  size?: 'sm' | 'md';
}

const CONTAINER_SIZE: Record<string, string> = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
};

/**
 * Avatar shown beside a conversation - the other participant's avatar for a
 * direct chat, or a small stacked cluster of member avatars for a group
 * chat (falls back to a plain group icon only when there's no member data).
 */
export function ConversationAvatar({ conversation, currentUserId, size = 'md' }: ConversationAvatarProps) {
  if (conversation.type === 'group') {
    const members = (conversation.participants || []).filter((p) => p.id !== currentUserId);
    const shown = members.slice(0, 2);

    if (shown.length === 0) {
      return (
        <div
          className={`${CONTAINER_SIZE[size]} rounded-full bg-gradient-to-br from-[#00d4ff] to-[#0099cc] flex items-center justify-center text-lg flex-shrink-0`}
        >
          👥
        </div>
      );
    }

    return (
      <div className={`relative ${CONTAINER_SIZE[size]} flex-shrink-0`}>
        {shown.map((member, i) => (
          <div
            key={member.id}
            className={`absolute rounded-full ring-2 ring-[#141414] overflow-hidden bg-gradient-to-br from-[#00d4ff] to-[#0099cc] flex items-center justify-center text-[10px] font-bold text-[#0a0a0a] ${
              shown.length === 1 ? 'inset-0' : i === 0 ? 'top-0 left-0 w-2/3 h-2/3' : 'bottom-0 right-0 w-2/3 h-2/3'
            }`}
          >
            {member.avatar_url ? (
              <img src={member.avatar_url} alt={member.username} className="w-full h-full object-cover" />
            ) : (
              member.username?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
        ))}
      </div>
    );
  }

  const other = conversation.participants?.find((p) => p.id !== currentUserId);
  return (
    <Avatar
      src={other?.avatar_url}
      name={other?.username}
      size={size === 'md' ? 'md' : 'sm'}
      className="flex-shrink-0"
    />
  );
}
