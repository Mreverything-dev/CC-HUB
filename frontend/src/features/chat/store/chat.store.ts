// frontend/src/features/chat/store/chat.store.ts
import { create } from 'zustand';
import { Conversation, Message } from '@/types/chat.types';

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  unreadCount: number;
  isLoading: boolean;
  isConnected: boolean;
  onlineUsers: string[];
  isWidgetOpen: boolean;
  // conversationId -> user IDs currently typing in that conversation
  typingByConversation: Record<string, string[]>;
  openWidget: () => void;
  closeWidget: () => void;
  toggleWidget: () => void;
  setUserTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, data: Partial<Conversation>) => void;
  /** "Delete Chat" - drops it from the local list/current-selection only;
   * the actual conversation on the server is untouched. */
  removeConversation: (id: string) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, data: Partial<Message>) => void;
  /** "Remove for Me" - drops one message from the caller's own local view
   * only; nothing changes on the server for anyone else (contrast with
   * updateMessage(id, { is_deleted: true, ... }), which is what "Unsend"
   * uses via the message:unsent broadcast, visible to everyone). */
  removeMessage: (id: string) => void;
  setUnreadCount: (count: number) => void;
  incrementUnreadCount: () => void;
  resetUnreadCount: () => void;
  setLoading: (loading: boolean) => void;
  setConnected: (connected: boolean) => void;
  setOnlineUsers: (users: string[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  unreadCount: 0,
  isLoading: false,
  isConnected: false,
  onlineUsers: [],
  isWidgetOpen: false,
  typingByConversation: {},

  openWidget: () => set({ isWidgetOpen: true }),

  closeWidget: () => set({ isWidgetOpen: false }),

  toggleWidget: () => set((state) => ({ isWidgetOpen: !state.isWidgetOpen })),

  setUserTyping: (conversationId, userId, isTyping) => set((state) => {
    const current = state.typingByConversation[conversationId] || [];
    const next = isTyping
      ? (current.includes(userId) ? current : [...current, userId])
      : current.filter((id) => id !== userId);
    return { typingByConversation: { ...state.typingByConversation, [conversationId]: next } };
  }),

  setConversations: (conversations) => set({ conversations }),
  
  setCurrentConversation: (currentConversation) => set({ currentConversation }),
  
  addConversation: (conversation) => set((state) => ({
    conversations: [conversation, ...state.conversations]
  })),
  
  updateConversation: (id, data) => set((state) => ({
    conversations: state.conversations.map((c) =>
      c.id === id ? { ...c, ...data } : c
    ),
    currentConversation: state.currentConversation?.id === id
      ? { ...state.currentConversation, ...data }
      : state.currentConversation
  })),

  removeConversation: (id) => set((state) => ({
    conversations: state.conversations.filter((c) => c.id !== id),
    currentConversation: state.currentConversation?.id === id ? null : state.currentConversation
  })),
  
  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  updateMessage: (id, data) => set((state) => ({
    messages: state.messages.map((m) =>
      m.id === id ? { ...m, ...data } : m
    )
  })),

  removeMessage: (id) => set((state) => ({
    messages: state.messages.filter((m) => m.id !== id)
  })),


  setUnreadCount: (unreadCount) => set({ unreadCount }),
  
  incrementUnreadCount: () => set((state) => ({
    unreadCount: state.unreadCount + 1
  })),
  
  resetUnreadCount: () => set({ unreadCount: 0 }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setConnected: (isConnected) => set({ isConnected }),
  
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
}));