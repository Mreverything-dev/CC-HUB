// frontend/src/features/announcements/components/AnnouncementShareMenu.tsx
import { useEffect, useRef, useState } from 'react';
import { ShareIcon, UserIcon, UserGroupIcon, LinkIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { postService } from '@/services/api/post.service';
import { chatApi } from '@/services/api/chat.service';
import { Conversation } from '@/types/chat.types';

interface AnnouncementShareMenuProps {
  announcementId: string;
  title: string;
}

/** Reuses the existing post-creation and chat-message APIs rather than
 * building dedicated "share" backend endpoints - sharing an announcement is
 * just posting/messaging a link to it. */
export function AnnouncementShareMenu({ announcementId, title }: AnnouncementShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'groups'>('menu');
  const [groups, setGroups] = useState<Conversation[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const link = `${window.location.origin}/announcements/${announcementId}`;

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setView('menu');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const close = () => {
    setOpen(false);
    setView('menu');
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard');
    close();
  };

  const handleShareToProfile = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await postService.createPost({ content: `📢 Shared an announcement: "${title}"\n${link}` });
      toast.success('Shared to your profile');
      close();
    } catch {
      toast.error('Failed to share to profile');
    } finally {
      setBusy(false);
    }
  };

  const openGroupPicker = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setView('groups');
    setLoadingGroups(true);
    try {
      const res = await chatApi.getConversations();
      setGroups(res.data.conversations.filter((c) => c.type === 'group'));
    } catch {
      toast.error('Failed to load group chats');
    } finally {
      setLoadingGroups(false);
    }
  };

  const shareToGroup = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await chatApi.sendMessage({
        conversation_id: conversationId,
        content: `📢 "${title}"\n${link}`,
      });
      toast.success('Shared to group chat');
      close();
    } catch {
      toast.error('Failed to share to group chat');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Share"
        className="p-1.5 text-[#64748B] hover:text-[#00C8FF] hover:bg-white/5 rounded-lg transition"
      >
        <ShareIcon className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl z-20 overflow-hidden">
            {view === 'menu' ? (
              <>
                <button
                  onClick={handleShareToProfile}
                  disabled={busy}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#F1F5F9] hover:bg-white/5 transition disabled:opacity-50"
                >
                  <UserIcon className="h-4 w-4 text-[#94A3B8]" />
                  Share to Profile
                </button>
                <button
                  onClick={openGroupPicker}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#F1F5F9] hover:bg-white/5 transition"
                >
                  <UserGroupIcon className="h-4 w-4 text-[#94A3B8]" />
                  Share to Group Chat
                </button>
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#F1F5F9] hover:bg-white/5 transition"
                >
                  <LinkIcon className="h-4 w-4 text-[#94A3B8]" />
                  Copy Link
                </button>
              </>
            ) : (
              <div>
                <button
                  onClick={(e) => { e.stopPropagation(); setView('menu'); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#94A3B8] hover:text-[#F1F5F9] border-b border-[#1E3447] transition"
                >
                  <ArrowLeftIcon className="h-3.5 w-3.5" />
                  Back
                </button>
                <div className="max-h-56 overflow-y-auto themed-scrollbar">
                  {loadingGroups ? (
                    <p className="px-3 py-3 text-xs text-[#64748B]">Loading group chats...</p>
                  ) : groups.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-[#64748B]">No group chats yet.</p>
                  ) : (
                    groups.map((g) => (
                      <button
                        key={g.id}
                        onClick={(e) => shareToGroup(e, g.id)}
                        disabled={busy}
                        className="w-full text-left px-3 py-2 text-sm text-[#F1F5F9] hover:bg-white/5 transition truncate disabled:opacity-50"
                      >
                        {g.name || 'Group Chat'}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
