// frontend/src/services/api/livestream.service.ts
import { api } from '@/lib/axios';
import { Livestream, LivestreamCreate, LivestreamUpdate, StreamViewer } from '@/types/livestream.types';

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
};