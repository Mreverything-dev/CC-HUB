// frontend/src/features/chat/hooks/useChat.ts
import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/services/api/chat.service';
import { useChatStore } from '../store/chat.store';
import { socketService } from '@/lib/socket';
import toast from 'react-hot-toast';

// Note: the socket connection itself is owned by SocketProvider (connects/disconnects
// based on auth state). This hook only joins rooms / emits on the existing connection.
export function useChat() {
  const queryClient = useQueryClient();
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
    setMessages,
    setUnreadCount,
    resetUnreadCount,
    setLoading,
  } = useChatStore();

  // Get conversations
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
    setCurrentConversation,
    handleTyping,
    markConversationRead,
    reactToMessage,
    refetchConversations,
  };
}