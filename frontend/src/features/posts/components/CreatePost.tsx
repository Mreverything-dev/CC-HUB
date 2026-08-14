// frontend/src/features/posts/components/CreatePost.tsx
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { PhotoIcon, XMarkIcon, FaceSmileIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import { mediaService } from '@/services/api/media.service';
import CreatePostModal from './CreatePostModal';

interface CreatePostProps {
  onCreatePost: (data: { content: string; media_urls?: string[]; visibility?: string }) => void | Promise<void>;
  isLoading?: boolean;
  /** Charcoal/cyan theme for the redesigned dashboard. Defaults to the original light theme. */
  dark?: boolean;
  /** Current user's avatar, already fetched by the parent dashboard for its Topbar/Sidebar. */
  avatarUrl?: string | null;
}

// Keep in sync with backend ALLOWED_TYPES in app/api/v1/endpoints/media.py
const ALLOWED_MEDIA_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
];

export function CreatePost({ onCreatePost, isLoading = false, dark = false, avatarUrl }: CreatePostProps) {
  const { user } = useAuthStore();
  const [showModal, setShowModal] = useState(false);

  // Premium dashboard theme: a slim trigger bar that opens the full
  // Create Post modal (composer, visibility, media, emoji, code snippet,
  // live preview) - all of it reuses the exact same onCreatePost/useFeed
  // flow as before, just presented as a modal instead of an inline form.
  if (dark) {
    return (
      <>
        <div className="mb-6 rounded-2xl border border-[rgba(0,200,245,0.18)] bg-[rgba(15,28,40,0.75)] backdrop-blur-xl p-4 sm:p-5 transition-all duration-200 hover:border-[#00C8FF]/30">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="w-full flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] flex items-center justify-center flex-shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={user?.username} className="w-full h-full object-cover" />
              ) : (
                <span className="font-semibold text-[#060B12]">{user?.username?.charAt(0).toUpperCase() || 'U'}</span>
              )}
            </div>
            <span className="flex-1 px-4 py-2.5 rounded-xl border border-[#1E3447] bg-[#0A111A] text-sm text-[#64748B]">
              What's on your mind, {user?.username || 'there'}?
            </span>
          </button>

          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#1E3447]">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#94A3B8] hover:text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-xl transition"
            >
              <PhotoIcon className="h-4 w-4" />
              Image
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#94A3B8] hover:text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-xl transition"
            >
              <FaceSmileIcon className="h-4 w-4" />
              Emoji
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#94A3B8] hover:text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-xl transition"
            >
              <CodeBracketIcon className="h-4 w-4" />
              Code Snippet
            </button>
          </div>
        </div>

        {showModal && (
          <CreatePostModal
            onClose={() => setShowModal(false)}
            onCreatePost={onCreatePost}
            isLoading={isLoading}
            avatarUrl={avatarUrl}
          />
        )}
      </>
    );
  }

  return <LegacyCreatePost onCreatePost={onCreatePost} isLoading={isLoading} />;
}

// Original light-theme inline composer, kept exactly as-is for any
// still-existing non-dashboard usage.
function LegacyCreatePost({
  onCreatePost,
  isLoading = false,
}: {
  onCreatePost: (data: { content: string; media_urls?: string[]; visibility?: string }) => void | Promise<void>;
  isLoading?: boolean;
}) {
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && mediaFiles.length === 0) return;

    let uploadedUrls: string[] = [];

    // Upload media files to MinIO
    if (mediaFiles.length > 0) {
      setIsUploading(true);
      setUploadError(null);
      try {
        const data = await mediaService.uploadFiles(mediaFiles);
        uploadedUrls = data.urls;
      } catch (error: any) {
        console.error('Upload error:', error);
        setUploadError(error.response?.data?.detail || 'Failed to upload media');
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    onCreatePost({
      content: content.trim(),
      media_urls: uploadedUrls,
    });

    setContent('');
    setMediaFiles([]);
    setShowMediaPreview(false);
    setUploadError(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // ✅ Filter valid media types
    const validFiles = files.filter(file => ALLOWED_MEDIA_TYPES.includes(file.type));
    if (validFiles.length !== files.length) {
      setUploadError('Some files were skipped. Allowed types: JPEG, PNG, GIF, WEBP, SVG, MP4, WEBM, MOV, AVI.');
    }
    setMediaFiles(validFiles);
    if (validFiles.length > 0) {
      setShowMediaPreview(true);
    }
  };

  const removeMedia = (index: number) => {
    const newFiles = mediaFiles.filter((_, i) => i !== index);
    setMediaFiles(newFiles);
    if (newFiles.length === 0) {
      setShowMediaPreview(false);
    }
  };

  const getPreviewUrl = (file: File) => {
    return URL.createObjectURL(file);
  };

  const isVideo = (file: File) => {
    return file.type.startsWith('video/');
  };

  const isImage = (file: File) => {
    return file.type.startsWith('image/');
  };

  // ✅ Get grid classes for media preview
  const getGridClasses = (count: number) => {
    if (count === 0) return '';
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-2';
    return 'grid-cols-2';
  };

  const getItemSpan = (index: number, total: number) => {
    if (total === 1) return 'col-span-1';
    if (total === 2) return 'col-span-1';
    if (total === 3 && index === 0) return 'col-span-2';
    return 'col-span-1';
  };

  const { user } = useAuthStore();

  return (
    <div className="glass rounded-xl p-6 mb-6 transition-all duration-200 hover:shadow-lg">
      <form onSubmit={handleSubmit}>
        <div className="flex items-start space-x-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-200">
            <span className="font-semibold text-gray-600">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
              rows={3}
            />

            {/* Upload Error */}
            {uploadError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                ❌ {uploadError}
              </div>
            )}

            {/* Media Preview */}
            {showMediaPreview && mediaFiles.length > 0 && (
              <div className={`mt-3 grid gap-2 ${getGridClasses(mediaFiles.length)}`}>
                {mediaFiles.map((file, index) => (
                  <div
                    key={index}
                    className={`${getItemSpan(index, mediaFiles.length)} relative group bg-gray-100 rounded-lg overflow-hidden`}
                  >
                    {isVideo(file) ? (
                      <video
                        src={getPreviewUrl(file)}
                        className="w-full h-40 object-cover"
                        controls
                      />
                    ) : isImage(file) ? (
                      <img
                        src={getPreviewUrl(file)}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-40 object-cover"
                      />
                    ) : (
                      <div className="w-full h-40 flex items-center justify-center text-gray-500">
                        📄 {file.name}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                    <span className="absolute bottom-2 left-2 text-xs bg-black/50 text-white px-2 py-1 rounded">
                      {file.type.split('/')[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex space-x-2">
                {/* Photo/Video Upload Button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-gray-500 hover:text-cyan-500 flex items-center gap-1"
                  disabled={isUploading}
                >
                  <PhotoIcon className="h-5 w-5" />
                  Media
                </Button>

                {mediaFiles.length > 0 && (
                  <span className="text-xs text-gray-400 self-center">
                    {mediaFiles.length} file(s) selected
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isUploading && (
                  <span className="text-sm text-gray-400 flex items-center gap-1">
                    <span className="animate-spin">⏳</span>
                    Uploading...
                  </span>
                )}
                <Button
                  type="submit"
                  disabled={(!content.trim() && mediaFiles.length === 0) || isLoading || isUploading}
                  className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition disabled:opacity-50"
                >
                  {isLoading || isUploading ? 'Posting...' : 'Post'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
