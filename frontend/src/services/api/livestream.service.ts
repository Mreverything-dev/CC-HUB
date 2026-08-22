// frontend/src/services/api/livestream.service.ts
import { api } from '@/lib/axios';
import { Livestream, LivestreamCreate, LivestreamUpdate, StreamViewer } from '@/types/livestream.types';

// Mirrors StreamChatMsg (features/livestream/hooks/useLiveStreamSignaling) -
// duplicated as a minimal shape here rather than imported, to avoid a
// service -> hook -> service circular import.
interface StreamCommentHistoryItem {
  id: string;
  stream_id: string;
  user_id: string;
  username: string;
  avatar?: string | null;
  message: string;
  timestamp: string;
  parent_comment_id?: string | null;
  is_deleted?: boolean;
  reactions: { user_id: string; reaction: string }[];
}

export const livestreamService = {
  // Create a livestream
  createStream: (data: LivestreamCreate) =>
    api.post<Livestream>('/livestream/', data),

  // Get all streams
  getStreams: (status?: string) =>
    api.get<Livestream[]>(`/livestream/?status=${status || ''}`),

  // Get a single stream
  getStream: (streamId: string) =>
    api.get<Livestream>(`/livestream/${streamId}`),

  // Update a stream
  updateStream: (streamId: string, data: LivestreamUpdate) =>
    api.put<Livestream>(`/livestream/${streamId}`, data),

  // Start a stream
  startStream: (streamId: string) =>
    api.post<Livestream>(`/livestream/${streamId}/start`),

  // End a stream
  endStream: (streamId: string) =>
    api.post<Livestream>(`/livestream/${streamId}/end`),

  // Join a stream as viewer
  joinStream: (streamId: string) =>
    api.post(`/livestream/${streamId}/join`),

  // Leave a stream
  leaveStream: (streamId: string) =>
    api.post(`/livestream/${streamId}/leave`),

  // Get stream viewers
  getViewers: (streamId: string) =>
    api.get<StreamViewer[]>(`/livestream/${streamId}/viewers`),

  // Persisted chat history - the database is the source of truth for
  // persistence, real-time delivery still flows entirely over the existing
  // Socket.IO stream:chat_message event.
  getComments: (streamId: string) =>
    api.get<StreamCommentHistoryItem[]>(`/livestream/${streamId}/comments`),
};