// frontend/src/features/chat/hooks/useChat.ts
import { useCallback } from 'react';
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

  // Get messages for a conversation
  const getMessages = useCallback(async (conversationId: string) => {
    setLoading(true);
    try {
      const response = await chatApi.getMessages(conversationId);
      setMessages(response.data);
      // Join the conversation room
      socketService.joinConversation(conversationId);
      // Mark messages as read
      socketService.markRead(conversationId);
      resetUnreadCount();
      return response.data;
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
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