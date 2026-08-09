// frontend/src/features/posts/components/CreatePost.tsx
import { useState } from 'react';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { useAuthStore } from '@/features/auth/store/auth.store';

interface CreatePostProps {
  onCreatePost: (content: string) => void;
  isLoading?: boolean;
}

export function CreatePost({ onCreatePost, isLoading = false }: CreatePostProps) {
  const [content, setContent] = useState('');
  const { user } = useAuthStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onCreatePost(content);
      setContent('');
    }
  };

  return (
    <Card variant="glass" className="mb-6">
      <form onSubmit={handleSubmit}>
        <div className="flex items-start space-x-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <span className="text-gray-600 font-semibold">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
              rows={3}
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-cyan-500"
                >
                  📷 Photo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-cyan-500"
                >
                  🔗 Link
                </Button>
              </div>
              <Button
                type="submit"
                disabled={!content.trim() || isLoading}
                className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition disabled:opacity-50"
              >
                {isLoading ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Card>
  );
}