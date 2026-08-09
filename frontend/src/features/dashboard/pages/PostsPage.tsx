// frontend/src/pages/PostsPage.tsx
import { CreatePost } from '@/features/posts/components/CreatePost';
import { PostCard } from '@/features/posts/components/PostCard';
import { useFeed } from '@/features/posts/hooks/useFeed';
import { Card } from '@/components/ui/Card/Card';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

export default function PostsPage() {
  const navigate = useNavigate();
  const {
    posts = [],
    isLoading,
    isPosting,
    createPost,
    toggleLike,
    deletePost,
    editPost,
  } = useFeed();

  const postList = Array.isArray(posts) ? posts : [];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-gray-500 hover:text-gray-700"
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">All Posts</h1>
      </div>

      <CreatePost onCreatePost={createPost} isLoading={isPosting} />

      <div className="space-y-4 mt-6">
        {isLoading && postList.length === 0 ? (
          <Card variant="glass" className="text-center py-8">
            <p className="text-gray-500">Loading posts...</p>
          </Card>
        ) : postList.length === 0 ? (
          <Card variant="glass" className="text-center py-8">
            <p className="text-gray-500">No posts yet.</p>
          </Card>
        ) : (
          postList.map((post) => (
            <PostCard
              key={post.id}
              {...post}
              onLike={toggleLike}
              onDelete={deletePost}
              onEdit={editPost}
            />
          ))
        )}
      </div>
    </div>
  );
}