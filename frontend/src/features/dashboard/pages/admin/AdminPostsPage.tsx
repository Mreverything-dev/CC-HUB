// frontend/src/features/dashboard/pages/admin/AdminPostsPage.tsx
import { useEffect, useState } from 'react';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  TrashIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/formatters';
import { AdminPostListItem } from '@/services/api/admin.service';
import { useAdminPosts } from '../../hooks/useAdminPosts';
import { useDebouncedValue } from '../../hooks/useAdminUsers';
import { useFeed } from '@/features/posts/hooks/useFeed';
import PostDetailModal from '@/features/posts/components/PostDetailModal';
import { Pagination } from '../../components/admin/users/Pagination';

const LIMIT = 15;

function PostActionsMenu({
  onView,
  onDelete,
}: {
  onView: () => void;
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        title="Actions"
        className="p-1.5 rounded-lg text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 transition"
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-44 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl py-1 z-20">
            <button
              onClick={() => {
                setIsOpen(false);
                onView();
              }}
              className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9] transition"
            >
              <EyeIcon className="h-4 w-4" />
              View Details
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onDelete();
              }}
              className="flex items-center gap-2 w-full px-3.5 py-2 text-sm text-[#EF4444] hover:bg-[#EF4444]/10 transition"
            >
              <TrashIcon className="h-4 w-4" />
              Remove Post
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function EngagementStats({ post }: { post: AdminPostListItem }) {
  return (
    <div className="flex items-center gap-3 text-xs text-[#64748B]">
      <span className="flex items-center gap-1">
        <HeartIcon className="h-3.5 w-3.5" />
        {post.likes_count}
      </span>
      <span className="flex items-center gap-1">
        <ChatBubbleLeftIcon className="h-3.5 w-3.5" />
        {post.comments_count}
      </span>
      <span className="flex items-center gap-1">
        <ShareIcon className="h-3.5 w-3.5" />
        {post.shares_count}
      </span>
    </div>
  );
}

export default function AdminPostsPage() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 350);
  const [page, setPage] = useState(1);
  const [confirmTarget, setConfirmTarget] = useState<AdminPostListItem | null>(null);
  const [viewPostId, setViewPostId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching, deletePost, isDeleting } = useAdminPosts({
    page,
    limit: LIMIT,
    search: search.trim() || undefined,
  });

  // The modal's edit/delete come from the same feed mutations the rest of
  // the app already uses for a post opened via global search - reused here
  // rather than re-implemented, then this page's own admin-scoped list is
  // refetched so the table reflects the change immediately.
  const { deletePost: feedDeletePost, editPost: feedEditPost } = useFeed();

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    await deletePost(confirmTarget.id);
    setConfirmTarget(null);
  };

  const items = data?.items || [];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F5F9]">Posts</h1>
          <p className="text-[#94A3B8] mt-1 text-sm">Moderate every post across CCS HUB.</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          title="Refresh"
          className="p-2 rounded-xl border border-[#1E3447] bg-[rgba(10,20,30,0.75)] text-[#94A3B8] hover:text-[#00C8FF] hover:border-[#00C8FF]/30 transition disabled:opacity-50 flex-shrink-0"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative">
        <MagnifyingGlassIcon className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search posts by content or author..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#1E3447] bg-[rgba(10,20,30,0.75)] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition"
        />
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1E3447] last:border-0 animate-pulse">
              <div className="h-9 w-9 rounded-full bg-[#1E3447] flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 rounded bg-[#1E3447]" />
                <div className="h-2.5 w-64 rounded bg-[#1E3447]" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] p-10 text-center">
          <p className="text-sm text-[#94A3B8]">Unable to load posts</p>
          <button onClick={() => refetch()} className="mt-3 flex items-center gap-1.5 mx-auto px-3.5 py-1.5 text-sm font-medium text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-lg transition">
            <ArrowPathIcon className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] p-10 text-center">
          <DocumentTextIcon className="h-10 w-10 mx-auto text-[#1E3447]" />
          <p className="text-[#94A3B8] mt-3">{search ? `No posts match "${search}"` : 'No posts yet'}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#1E3447]">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Author</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Content</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Engagement</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Posted</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((post) => (
                  <tr key={post.id} className="border-b border-[#1E3447] last:border-0 hover:bg-white/[0.03] transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar src={post.author_avatar_url} name={post.author_full_name || post.author_username} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#F1F5F9] truncate">{post.author_full_name || post.author_username}</p>
                          <RoleBadge role={post.author_role} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-sm text-[#94A3B8] line-clamp-2 [overflow-wrap:anywhere]">{post.content || '(no text - media only)'}</p>
                      {post.media_urls.length > 0 && (
                        <span className="text-[10px] text-[#64748B]">{post.media_urls.length} attachment{post.media_urls.length > 1 ? 's' : ''}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <EngagementStats post={post} />
                    </td>
                    <td className="px-4 py-3 text-sm text-[#94A3B8] whitespace-nowrap">{formatDate(post.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <PostActionsMenu onView={() => setViewPostId(post.id)} onDelete={() => setConfirmTarget(post)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {items.map((post) => (
              <div key={post.id} className="rounded-2xl border border-[rgba(0,200,245,0.15)] bg-[rgba(10,20,30,0.75)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={post.author_avatar_url} name={post.author_full_name || post.author_username} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F1F5F9] truncate">{post.author_full_name || post.author_username}</p>
                      <RoleBadge role={post.author_role} />
                    </div>
                  </div>
                  <PostActionsMenu onView={() => setViewPostId(post.id)} onDelete={() => setConfirmTarget(post)} />
                </div>
                <p className="text-sm text-[#94A3B8] mt-3 line-clamp-3 [overflow-wrap:anywhere]">{post.content || '(no text - media only)'}</p>
                <div className="flex items-center justify-between mt-3">
                  <EngagementStats post={post} />
                  <p className="text-xs text-[#64748B]">{formatDate(post.created_at)}</p>
                </div>
              </div>
            ))}
          </div>

          {data && (
            <Pagination page={data.page} totalPages={data.total_pages} total={data.total} limit={data.limit} onChange={setPage} itemLabel="posts" />
          )}
        </>
      )}

      {confirmTarget && (
        <ConfirmDialog
          title="Remove this post?"
          message={`This post by ${confirmTarget.author_full_name || confirmTarget.author_username} will be permanently deleted for everyone.`}
          confirmLabel="Remove"
          danger
          isLoading={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {viewPostId && (
        <PostDetailModal
          postId={viewPostId}
          onClose={() => setViewPostId(null)}
          onDelete={(id) => {
            feedDeletePost(id);
            refetch();
          }}
          onEdit={(id, content) => {
            feedEditPost(id, content);
            refetch();
          }}
        />
      )}
    </div>
  );
}
