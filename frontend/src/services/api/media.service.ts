// frontend/src/services/api/media.service.ts
import { api } from '@/lib/axios';

export const mediaService = {
  /**
   * Upload one or more media files
   * @param files - Array of File objects (images/videos)
   * @returns Promise with URLs of uploaded files
   */
  uploadFiles: async (files: File[]): Promise<{ urls: string[]; files?: any[] }> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  /**
   * Delete a media file by filename
   * @param objectName - The object name/path in storage
   */
  deleteFile: async (objectName: string): Promise<{ message: string }> => {
    const response = await api.delete(`/media/${objectName}`);
    return response.data;
  },

  /**
   * Get a presigned URL for temporary access to a private file
   * @param objectName - The object name/path in storage
   * @param expiry - Expiry time in seconds (default: 3600)
   */
  getPresignedUrl: async (objectName: string, expiry: number = 3600): Promise<{ url: string }> => {
    const response = await api.get(`/media/presigned/${objectName}?expiry=${expiry}`);
    return response.data;
  },
};