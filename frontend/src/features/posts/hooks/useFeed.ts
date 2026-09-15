// frontend/src/features/posts/hooks/useFeed.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { postService, Post } from '@/services/api/post.service';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { socketService } from '@/lib/socket';
import {
  PostReactionUpdatedPayload,
  PostCommentAddedPayload,
  PostCommentDeletedPayload,
  PostShareUpdatedPayload,
} from './usePostRoom';
import toast from 'react-hot-toast';

// ✅ Add FeedFilter type
export type FeedFilter = 'all' | 'following' | 'section' | 'video';

export function useFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  // ✅ Add filter state
  const [filter, setFilter] = useState<FeedFilter>('all');
  const { isAuthenticated, user } = useAuthStore();

  // ✅ Helper: Deduplicate posts by ID
  const deduplicatePosts = useCallback((items: Post[]): Post[] => {
    const seen = new Set<string>();
    const unique: Post[] = [];
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      }
    }
    return unique;
  }, []);

  // ✅ Helper: Apply filter to posts
  const applyFilter = useCallback((items: Post[], currentFilter: FeedFilter): Post[] => {
    switch (currentFilter) {
      case 'video':
        // Filter posts with video media
        return items.filter(post => 
          post.media_urls?.some(url => 
            url.match(/\.(mp4|webm|mov|avi|mkv)$/i) || url.includes('video')
          )
        );
      case 'section':
        // Filter posts from user's section
        // This uses the section visibility or section_id
        return items.filter(post => post.visibility === 'section');
      case 'following':
        // Filter posts from friends (following)
        return items.filter(post => post.visibility === 'friends');
      case 'all':
      default:
        return items;
    }
  }, []);

  const fetchFeed = useCallback(async (pageNum: number = 1, currentFilter?: FeedFilter) => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      const response = await postService.getFeed(pageNum, 20);
      const { items, total: feedTotal } = response.data;
      
      // Deduplicate items
      const uniqueItems = deduplicatePosts(items);
      
      // Apply filter if needed
      const filteredItems = currentFilter 
        ? applyFilter(uniqueItems, currentFilter)
        : uniqueItems;
      
      if (pageNum === 1) {
        setPosts(filteredItems);
      } else {
        setPosts((prev) => {
          const merged = [...prev, ...filteredItems];
          return deduplicatePosts(merged);
        });
      }
      setTotal(feedTotal);
      setHasMore(items.length === 20 && items.length < feedTotal);
    } catch (error) {
      console.error('Error fetching feed:', error);
      toast.error('Failed to load feed');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, deduplicatePosts, applyFilter]);

  // ✅ Handle filter change
  const handleFilterChange = useCallback((newFilter: FeedFilter) => {
    setFilter(newFilter);
    setPage(1);
    fetchFeed(1, newFilter);
  }, [fetchFeed]);

  // ✅ Updated: Accept object with content, media_urls, and visibility
  const createPost = async (data: { content: string; media_urls?: string[]; visibility?: string }) => {
    setIsPosting(true);
    try {
      await postService.createPost({
        content: data.content,
        media_urls: data.media_urls || [],
        type: data.media_urls && data.media_urls.length > 0 ? 'image' : 'text',
        visibility: data.visibility || 'public'
      });
      toast.success('Post created successfully!');
      await fetchFeed(1, filter);
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
      setPosts((prev) => {
        const updated = prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                is_liked_by_current_user: !post.is_liked_by_current_user,
                likes_count: post.is_liked_by_current_user
                  ? post.likes_count - 1
                  : post.likes_count + 1,
              }
            : post
        );
        return deduplicatePosts(updated);
      });
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const reactToPost = async (postId: string, reaction: string) => {
    const previous = posts.find((p) => p.id === postId);
    const optimisticReaction = previous?.my_reaction === reaction ? null : reaction;
    
    setPosts((prev) => {
      const updated = prev.map((post) => {
        if (post.id !== postId) return post;
        const breakdown = { ...post.reaction_breakdown };
        if (post.my_reaction) breakdown[post.my_reaction] = Math.max(0, (breakdown[post.my_reaction] || 1) - 1);
        if (optimisticReaction) breakdown[optimisticReaction] = (breakdown[optimisticReaction] || 0) + 1;
        return {
          ...post,
          my_reaction: optimisticReaction,
          reaction_breakdown: breakdown,
          reactions_count: Object.values(breakdown).reduce((a, b) => a + b, 0),
        };
      });
      return deduplicatePosts(updated);
    });

    try {
      const response = await postService.reactToPost(postId, reaction);
      setPosts((prev) => {
        const updated = prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                my_reaction: response.data.reaction,
                reaction_breakdown: response.data.reaction_breakdown,
                reactions_count: response.data.reactions_count,
              }
            : post
        );
        return deduplicatePosts(updated);
      });
    } catch (error) {
      console.error('Error reacting to post:', error);
      if (previous) {
        setPosts((prev) => prev.map((post) => (post.id === postId ? previous : post)));
      }
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
      setPosts((prev) => {
        const updated = prev.map((post) =>
          post.id === postId ? { ...post, content, updated_at: new Date().toISOString() } : post
        );
        return deduplicatePosts(updated);
      });
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
      fetchFeed(nextPage, filter);
    }
  };

  useEffect(() => {
    fetchFeed(1, filter);
  }, [fetchFeed]);

  // Real-time updates
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentIds = new Set(posts.map((p) => p.id));
    currentIds.forEach((id) => {
      if (!joinedRoomsRef.current.has(id)) {
        socketService.joinPostRoom(id);
        joinedRoomsRef.current.add(id);
      }
    });
    Array.from(joinedRoomsRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        socketService.leavePostRoom(id);
        joinedRoomsRef.current.delete(id);
      }
    });
  }, [posts]);

  useEffect(() => {
    const handleReaction = (data: PostReactionUpdatedPayload) => {
      setPosts((prev) => {
        const updated = prev.map((post) => {
          if (post.id !== data.post_id) return post;
          const next = { ...post, reactions_count: data.reactions_count, reaction_breakdown: data.reaction_breakdown };
          if (data.user_id === user?.id) next.my_reaction = data.reaction;
          return next;
        });
        return deduplicatePosts(updated);
      });
    };
    const handleCommentAdded = (data: PostCommentAddedPayload) => {
      setPosts((prev) => {
        const updated = prev.map((post) => (post.id === data.post_id ? { ...post, comments_count: data.comments_count } : post));
        return deduplicatePosts(updated);
      });
    };
    const handleCommentDeleted = (data: PostCommentDeletedPayload) => {
      setPosts((prev) => {
        const updated = prev.map((post) => (post.id === data.post_id ? { ...post, comments_count: data.comments_count } : post));
        return deduplicatePosts(updated);
      });
    };
    const handleShare = (data: PostShareUpdatedPayload) => {
      setPosts((prev) => {
        const updated = prev.map((post) => (post.id === data.post_id ? { ...post, shares_count: data.shares_count } : post));
        return deduplicatePosts(updated);
      });
    };

    socketService.on('post:reaction_updated', handleReaction);
    socketService.on('post:comment_added', handleCommentAdded);
    socketService.on('post:comment_deleted', handleCommentDeleted);
    socketService.on('post:share_updated', handleShare);

    return () => {
      socketService.off('post:reaction_updated', handleReaction);
      socketService.off('post:comment_added', handleCommentAdded);
      socketService.off('post:comment_deleted', handleCommentDeleted);
      socketService.off('post:share_updated', handleShare);
    };
  }, [user?.id, deduplicatePosts]);

  useEffect(() => {
    return () => {
      joinedRoomsRef.current.forEach((id) => socketService.leavePostRoom(id));
      joinedRoomsRef.current.clear();
    };
  }, []);

  return {
    posts,
    isLoading,
    isPosting,
    hasMore,
    total,
    filter,
    setFilter: handleFilterChange,
    createPost,
    toggleLike,
    reactToPost,
    deletePost,
    editPost,
    loadMore,
    refreshFeed: () => fetchFeed(1, filter),
  };
}