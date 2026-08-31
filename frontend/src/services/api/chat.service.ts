// frontend/src/services/api/chat.service.ts
import { api } from '@/lib/axios';
import { Conversation, GroupMember, Message, ConversationCreate, MessageCreate } from '@/types/chat.types';

export const chatApi = {
  // Conversations
  getConversations: () => 
    api.get<{ conversations: Conversation[]; total: number }>('/chat/conversations'),
  
  getOrCreateDirectConversation: (userId: string) => 
    api.post<Conversation>(`/chat/conversations/direct/${userId}`),
  
  createGroupConversation: (data: ConversationCreate) =>
    api.post<Conversation>('/chat/conversations/group', data),

  // "Delete Chat" - removes the conversation from the caller's own list
  // only (their membership, and everyone else's access, is untouched).
  deleteConversation: (conversationId: string) =>
    api.delete<{ message: string }>(`/chat/conversations/${conversationId}`),

  // Group chat members + logo
  getGroupMembers: (conversationId: string) =>
    api.get<GroupMember[]>(`/chat/conversations/${conversationId}/members`),

  getGroupLogoPermission: (conversationId: string) =>
    api.get<{ can_edit_logo: boolean }>(`/chat/conversations/${conversationId}/logo-permission`),

  updateGroupLogo: (conversationId: string, avatarUrl: string) =>
    api.put<Conversation>(`/chat/conversations/${conversationId}/logo`, { avatar_url: avatarUrl }),


  // Messages
  getMessages: (conversationId: string, limit: number = 50, before?: string) => 
    api.get<Message[]>(`/chat/conversations/${conversationId}/messages`, {
      params: { limit, before }
    }),
  
  sendMessage: (data: MessageCreate) => 
    api.post<Message>('/chat/messages', data),
  
  markMessageRead: (messageId: string) =>
    api.post(`/chat/messages/${messageId}/read`),

  // "Remove for Me" - hides one message from the caller's own view only.
  // "Unsend" (visible to everyone) goes over the socket instead - see
  // socketService.unsendMessage - since it needs to broadcast in real time.
  removeMessageForMe: (messageId: string) =>
    api.post<{ message_id: string }>(`/chat/messages/${messageId}/remove-for-me`),
};