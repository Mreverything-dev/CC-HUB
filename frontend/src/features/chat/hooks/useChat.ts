// frontend/src/features/chat/hooks/useChat.ts
import { useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/services/api/chat.service';
import { useChatStore } from '../store/chat.store';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { socketService } from '@/lib/socket';
import toast from 'react-hot-toast';

// Note: the socket connection itself is owned by SocketProvider (connects/disconnects
// based on auth state). This hook only joins rooms / emits on the existing connection.
export function useChat() {
  const queryClient = useQueryClient();
  // ChatWidget (mounted globally at the app root, on every route including
  // public/unauthenticated pages like reset-password, verify-email, and
  // confirm-password-change) calls this hook unconditionally. Without this
  // guard, the conversations query below fired on every page load with no
  // token, 401'd, and the axios interceptor's refresh-then-redirect logic
  // (see lib/axios.ts) hard-navigated the browser to /login - which is what
  // made an unauthenticated visitor's reset-password page flash and
  // disappear seconds after loading, even though nothing was actually wrong.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const {
    conversations,
    currentConversation,
    messages,
    unreadCount,
    isConnected,
    isWidgetOpen,
    typingByConversation,
    minimizedConversationIds,
    openWidget,
    closeWidget,
    toggleWidget,
    setConversations,
    setCurrentConversation,
    addConversation,
    updateConversation,
    removeConversation,
    removeMessage,
    setMessages,
    setUnreadCount,
    resetUnreadCount,
    setLoading,
    minimizeConversation,
    restoreConversation,
  } = useChatStore();


  // Get conversations - only ever meaningful (and only ever valid to call)
  // once someone is actually logged in; see the isAuthenticated comment above.
  const { isLoading: isLoadingConversations, refetch: refetchConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const response = await chatApi.getConversations();
      setConversations(response.data.conversations);
      // Calculate total unread count
      const totalUnread = response.data.conversations.reduce(
        (sum: number, c: any) => sum + (c.unread_count || 0), 0
      );
      setUnreadCount(totalUnread);
      return response.data;
    },
    enabled: isAuthenticated,
  });

  // Get messages for a conversation.
  // - Initial load: pass nothing (default 50 latest).
  // - Backread: pass { before: <oldest.created_at>, append: true } to
  //   fetch older messages and prepend them to the existing list.
  const getMessages = useCallback(async (
    conversationId: string,
    options?: { limit?: number; before?: string; append?: boolean }
  ) => {
    setLoading(true);
    try {
      const response = await chatApi.getMessages(
        conversationId,
        options?.limit ?? 50,
        options?.before
      );

      if (options?.append) {
        // Backread: idagdag sa TAAS ng existing messages (dedupe by id)
        const existing = useChatStore.getState().messages;
        const existingIds = new Set(existing.map((m) => m.id));
        const newOnes = response.data.filter((m) => !existingIds.has(m.id));
        setMessages([...newOnes, ...existing]);
      } else {
        // Initial load: i-replace lahat
        setMessages(response.data);
        // Join the conversation room
        socketService.joinConversation(conversationId);
        // Mark messages as read
        socketService.markRead(conversationId);
        resetUnreadCount();
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
      return [];
    } finally {
      setLoading(false);
    }
  }, [setLoading, setMessages, resetUnreadCount]);

  // Send message
  const sendMessage = useCallback((
    conversationId: string,
    content: string,
    options?: { type?: string; mediaUrl?: string; mediaName?: string }
  ) => {
    if (!content.trim()) return;

    try {
      // Send via WebSocket for real-time
      socketService.sendMessage(conversationId, content, options?.type || 'text', options?.mediaUrl, options?.mediaName);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  }, []);

  // Create direct conversation
  const createDirectConversation = useMutation({
    mutationFn: (userId: string) => chatApi.getOrCreateDirectConversation(userId),
    onSuccess: (response) => {
      addConversation(response.data);
      setCurrentConversation(response.data);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create conversation');
    },
  });

  // Delete Chat - hides this conversation from the current user's own list
  // only (see ChatService.delete_conversation_for_user). Removed from local
  // state immediately rather than waiting on a refetch, matching how
  // addConversation already does for the opposite (create) case.
  const deleteConversation = useMutation({
    mutationFn: (conversationId: string) => chatApi.deleteConversation(conversationId),
    onSuccess: (_response, conversationId) => {
      removeConversation(conversationId);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Chat removed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to remove chat');
    },
  });

  // Handle typing
  const handleTyping = useCallback((conversationId: string, isTyping: boolean) => {
    socketService.sendTyping(conversationId, isTyping);
  }, []);

  // React to a message (add/change/remove) - the resulting reaction state
  // comes back via the 'message:reaction' socket event (see lib/socket.ts),
  // which updates the store for every client viewing the conversation.
  const reactToMessage = useCallback((messageId: string, reaction: string) => {
    socketService.reactToMessage(messageId, reaction);
  }, []);

  // "Unsend" - visible to everyone. Same round-trip pattern as
  // reactToMessage: the actual UI update (is_deleted/content wiped) comes
  // back via the 'message:unsent' socket event, including for the sender's
  // own view, not applied optimistically here.
  const unsendMessage = useCallback((messageId: string) => {
    socketService.unsendMessage(messageId);
  }, []);

  // "Remove for Me" - local-only, nothing to broadcast, so this is a plain
  // REST call + an immediate local store update (mirrors deleteConversation).
  const removeMessageForMe = useMutation({
    mutationFn: (messageId: string) => chatApi.removeMessageForMe(messageId),
    onSuccess: (_response, messageId) => {
      removeMessage(messageId);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to remove message');
    },
  });

  // Mark conversation as read
  const markConversationRead = useCallback((conversationId: string) => {
    socketService.markRead(conversationId);
    resetUnreadCount();
  }, [resetUnreadCount]);

  // ✅ Listen for 'message:read' socket events so the current user's own
  // sent messages get their ✓✓ (Seen) indicator without needing a page
  // reload.
  useEffect(() => {
    if (!isConnected) return;

    const handleMessagesRead = (data: any) => {
      console.log('📖 [message:read] received:', data);

      // Accept either { conversation_id } or { conversationId } - backend
      // naming might differ.
      const convId = data.conversation_id ?? data.conversationId;
      const readerId = data.reader_id ?? data.readerId ?? data.user_id;

      // Only care about the conversation we're currently viewing.
      if (convId && convId !== currentConversation?.id) return;
      // Ignore if WE are the one who read it.
      const currentUserId = useAuthStore.getState().user?.id;
      if (readerId && readerId === currentUserId) return;

      // Mark every message from the current user in this conversation as read.
      const updated = useChatStore.getState().messages.map((m) =>
        m.sender_id === currentUserId && !m.is_read ? { ...m, is_read: true } : m
      );
      useChatStore.getState().setMessages(updated);
    };

    socketService.on('message:read', handleMessagesRead);
    return () => socketService.off('message:read', handleMessagesRead);
  }, [isConnected, currentConversation?.id]);

  return {
    conversations,
    currentConversation,
    messages,
    unreadCount,
    isConnected,
    isWidgetOpen,
    typingByConversation,
    openWidget,
    closeWidget,
    toggleWidget,
    isLoading: isLoadingConversations,
    getMessages,
    sendMessage,
    createDirectConversation: createDirectConversation.mutateAsync,
    deleteConversation: deleteConversation.mutateAsync,
    unsendMessage,
    removeMessageForMe: removeMessageForMe.mutateAsync,
    setCurrentConversation,
    updateConversation,
    handleTyping,
    markConversationRead,
    reactToMessage,
    refetchConversations,
  };
}