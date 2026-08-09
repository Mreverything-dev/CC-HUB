// frontend/src/features/posts/hooks/useFeed.ts
import { useState, useEffect, useCallback } from 'react';
import { postService, Post } from '@/services/api/post.service';
import { useAuthStore } from '@/features/auth/store/auth.store';
import toast from 'react-hot-toast';

export function useFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const { isAuthenticated } = useAuthStore();

  const fetchFeed = useCallback(async (pageNum: number = 1) => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      const response = await postService.getFeed(pageNum, 20);
      const { items, total: feedTotal } = response.data;
      if (pageNum === 1) {
        setPosts(items);
      } else {
        setPosts((prev) => [...prev, ...items]);
      }
      setTotal(feedTotal);
      setHasMore(items.length === 20 && items.length < feedTotal);
    } catch (error) {
      console.error('Error fetching feed:', error);
      toast.error('Failed to load feed');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // ✅ Updated: Accept object with content and media_urls
  const createPost = async (data: { content: string; media_urls?: string[] }) => {
    setIsPosting(true);
    try {
      await postService.createPost({
        content: data.content,
        media_urls: data.media_urls || [],
        type: data.media_urls && data.media_urls.length > 0 ? 'image' : 'text',
        visibility: 'public'
      });
      toast.success('Post created successfully!');
      await fetchFeed(1);
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    } finally {
      setIsPosting(false);
    }
  };

  const toggleLike = async (postId: string) => {
    try {
      await postService.likePost(postId);
      // Update local state
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                is_liked_by_current_user: !post.is_liked_by_current_user,
                likes_count: post.is_liked_by_current_user
                  ? post.likes_count - 1
                  : post.likes_count + 1,
              }
            : post
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const deletePost = async (postId: string) => {
    try {
      await postService.deletePost(postId);
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      toast.success('Post deleted successfully');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  const editPost = async (postId: string, content: string) => {
    try {
      await postService.updatePost(postId, content);
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, content, updated_at: new Date().toISOString() } : post
        )
      );
      toast.success('Post updated successfully');
    } catch (error) {
      console.error('Error updating post:', error);
      toast.error('Failed to update post');
    }
  };

  const loadMore = () => {
    if (hasMore && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchFeed(nextPage);
    }
  };

  useEffect(() => {
    fetchFeed(1);
  }, [fetchFeed]);

  return {
    posts,
    isLoading,
    isPosting,
    hasMore,
    total,
    createPost,  // ✅ Now accepts { content, media_urls }
    toggleLike,
    deletePost,
    editPost,
    loadMore,
    refreshFeed: () => fetchFeed(1),
  };
}