// frontend/src/features/posts/components/CreatePost.tsx
import { useState } from 'react';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { PhotoIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import CreatePostModal from './CreatePostModal';

interface CreatePostProps {
  onCreatePost: (data: { content: string; media_urls?: string[]; visibility?: string }) => void | Promise<void>;
  isLoading?: boolean;
  dark?: boolean;
  avatarUrl?: string | null;
}

export function CreatePost({ onCreatePost, isLoading = false, avatarUrl }: CreatePostProps) {
  const { user } = useAuthStore();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
                  <div className="mb-6 rounded-2xl border border-border bg-glass backdrop-blur-xl p-4 sm:p-5 transition-all duration-200 hover:border-[#00C8FF]/30">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="w-full flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] flex items-center justify-center flex-shrink-0 overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={user?.username} className="w-full h-full object-cover" />
            ) : (
              <span className="font-semibold text-[#060B12]">{user?.username?.charAt(0).toUpperCase() || 'U'}</span>
            )}
          </div>
          <span className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-bg text-sm text-text-muted">
            What's on your mind, {user?.username || 'there'}?
          </span>
        </button>

        <div className="flex items-center flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-xl transition"
          >
            <PhotoIcon className="h-4 w-4" />
            Upload
          </button>
          
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-xl transition"
          >
            <CodeBracketIcon className="h-4 w-4" />
            Code Snippet
          </button>
        </div>
      </div>

      {showModal && (
        <CreatePostModal
          onClose={() => setShowModal(false)}
          onCreatePost={onCreatePost}
          isLoading={isLoading}
          avatarUrl={avatarUrl}
        />
      )}
    </>
  );
}
