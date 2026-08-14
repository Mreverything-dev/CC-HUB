// frontend/src/features/posts/components/CreatePostModal.tsx
import { useEffect, useRef, useState } from 'react';
import {
  XMarkIcon,
  PhotoIcon,
  CodeBracketIcon,
  ChevronDownIcon,
  GlobeAltIcon,
  UserGroupIcon,
  AcademicCapIcon,
  LockClosedIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { mediaService } from '@/services/api/media.service';
import { RoleBadge } from '@/features/dashboard/components/RoleBadge';
import { EmojiPicker } from './EmojiPicker';
import { PostContentBody } from './PostContentBody';

// Keep in sync with backend ALLOWED_TYPES in app/api/v1/endpoints/media.py
const ALLOWED_MEDIA_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
];

const MAX_CONTENT_LENGTH = 2000;

type Visibility = 'public' | 'friends' | 'section' | 'private';

const VISIBILITY_OPTIONS: { id: Visibility; label: string; icon: typeof GlobeAltIcon; description: string }[] = [
  { id: 'public', label: 'Public', icon: GlobeAltIcon, description: 'Anyone on CCS HUB can see this' },
  { id: 'friends', label: 'Friends', icon: UserGroupIcon, description: 'Only your friends' },
  { id: 'section', label: 'Section', icon: AcademicCapIcon, description: 'Only people in your section(s)' },
  { id: 'private', label: 'Private', icon: LockClosedIcon, description: 'Only you' },
];

// Maps a friendly label to the fenced-code-block language tag used in the
// post's plain-text content - keeps this purely a client-side formatting
// convention rather than a new backend field.
const CODE_LANGUAGES = [
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'csharp', label: 'C#' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'sql', label: 'SQL' },
  { id: 'json', label: 'JSON' },
  { id: 'bash', label: 'Bash' },
];

interface CreatePostModalProps {
  onClose: () => void;
  onCreatePost: (data: { content: string; media_urls?: string[]; visibility?: string }) => void | Promise<void>;
  isLoading?: boolean;
  avatarUrl?: string | null;
}

export default function CreatePostModal({ onClose, onCreatePost, isLoading = false, avatarUrl }: CreatePostModalProps) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [codeDraft, setCodeDraft] = useState('');
  const [codeSnippet, setCodeSnippet] = useState<{ language: string; code: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const visibilityMenuRef = useRef<HTMLDivElement>(null);

  const isBusy = isUploading || isLoading;

  // Auto-expand the textarea as the user types.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [content]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!showVisibilityMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (visibilityMenuRef.current && !visibilityMenuRef.current.contains(e.target as Node)) {
        setShowVisibilityMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showVisibilityMenu]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isBusy, onClose]);

  useEffect(() => {
    return () => mediaPreviews.forEach((url) => URL.revokeObjectURL(url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName = user?.username || 'You';
  const hasContent = content.trim().length > 0 || mediaFiles.length > 0 || !!codeSnippet;

  const addFiles = (files: File[]) => {
    const validFiles = files.filter((f) => ALLOWED_MEDIA_TYPES.includes(f.type));
    if (validFiles.length !== files.length) {
      setUploadError('Some files were skipped. Allowed types: JPEG, PNG, GIF, WEBP, SVG, MP4, WEBM, MOV, AVI.');
    } else {
      setUploadError(null);
    }
    if (validFiles.length === 0) return;
    setMediaFiles((prev) => [...prev, ...validFiles]);
    setMediaPreviews((prev) => [...prev, ...validFiles.map((f) => URL.createObjectURL(f))]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };

  const removeMedia = (index: number) => {
    setMediaPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files));
  };

  const handleEmojiSelect = (emoji: string) => {
    setContent((prev) => (prev.length >= MAX_CONTENT_LENGTH ? prev : `${prev}${emoji}`));
    textareaRef.current?.focus();
  };

  const handleAddCodeSnippet = () => {
    if (!codeDraft.trim()) return;
    setCodeSnippet({ language: codeLanguage, code: codeDraft });
    setCodeDraft('');
    setShowCodeEditor(false);
  };

  const handleRemoveCodeSnippet = () => setCodeSnippet(null);

  const isVideo = (file: File) => file.type.startsWith('video/');
  const isImage = (file: File) => file.type.startsWith('image/');

  const handleSubmit = async () => {
    if (!hasContent || isBusy) return;

    let uploadedUrls: string[] = [];
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
      }
      setIsUploading(false);
    }

    const finalContent = codeSnippet
      ? `${content.trim()}\n\n\`\`\`${codeSnippet.language}\n${codeSnippet.code}\n\`\`\``.trim()
      : content.trim();

    await onCreatePost({ content: finalContent, media_urls: uploadedUrls, visibility });
    onClose();
  };

  const selectedVisibility = VISIBILITY_OPTIONS.find((v) => v.id === visibility)!;

  const getGridClasses = (count: number) => {
    if (count <= 1) return 'grid-cols-1';
    return 'grid-cols-2';
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={() => !isBusy && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Create Post"
    >
      <style>{`
        @keyframes createPostModalIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        className="w-full sm:max-w-xl max-h-[95vh] sm:max-h-[85vh] flex flex-col rounded-2xl border border-[rgba(0,200,245,0.18)] bg-[#0D1722] shadow-[0_0_60px_rgba(0,200,245,0.08)] overflow-hidden"
        style={{ animation: 'createPostModalIn 0.18s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E3447] flex-shrink-0">
          <h2 className="text-base font-semibold text-[#F1F5F9]">Create Post</h2>
          <button
            onClick={() => !isBusy && onClose()}
            disabled={isBusy}
            aria-label="Close"
            className="p-1.5 rounded-xl text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 transition disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto themed-scrollbar px-5 py-4 space-y-4">
          {/* Identity + visibility */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] flex items-center justify-center overflow-hidden flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="font-semibold text-[#060B12]">{displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-[#F1F5F9] truncate">{displayName}</p>
                <RoleBadge role={user?.role || 'student'} />
              </div>
              <div className="relative mt-1" ref={visibilityMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowVisibilityMenu((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={showVisibilityMenu}
                  className="flex items-center gap-1 px-2 py-1 -ml-2 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 transition"
                >
                  <selectedVisibility.icon className="h-3.5 w-3.5" />
                  {selectedVisibility.label}
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
                {showVisibilityMenu && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full mt-1 w-56 rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl py-1 z-20"
                  >
                    {VISIBILITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        role="menuitem"
                        onClick={() => {
                          setVisibility(opt.id);
                          setShowVisibilityMenu(false);
                        }}
                        className="flex items-start gap-2.5 w-full px-3 py-2 text-left hover:bg-white/5 transition"
                      >
                        <opt.icon className="h-4 w-4 text-[#94A3B8] mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-[#F1F5F9]">{opt.label}</p>
                          <p className="text-xs text-[#64748B]">{opt.description}</p>
                        </div>
                        {visibility === opt.id && <CheckIcon className="h-4 w-4 text-[#00C8FF] flex-shrink-0 mt-0.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Composer */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-xl border transition ${isDragging ? 'border-[#00C8FF] bg-[#00C8FF]/5' : 'border-transparent'}`}
          >
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT_LENGTH))}
              placeholder={`What's on your mind, ${displayName}?`}
              rows={3}
              className="w-full p-3 rounded-xl border border-[#1E3447] bg-[#0A111A] text-[#F1F5F9] placeholder-[#64748B] focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none resize-none transition"
            />
          </div>
          <div className="flex items-center justify-end -mt-2">
            <span className={`text-[11px] ${content.length >= MAX_CONTENT_LENGTH ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
              {content.length} / {MAX_CONTENT_LENGTH}
            </span>
          </div>

          {uploadError && (
            <div className="p-2.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm">
              ❌ {uploadError}
            </div>
          )}

          {/* Media preview */}
          {mediaPreviews.length > 0 && (
            <div className={`grid gap-2 ${getGridClasses(mediaPreviews.length)}`}>
              {mediaFiles.map((file, index) => (
                <div key={index} className="relative rounded-xl overflow-hidden bg-[#0A111A] border border-[#1E3447]">
                  {isVideo(file) ? (
                    <video src={mediaPreviews[index]} className="w-full h-40 object-cover" controls />
                  ) : isImage(file) ? (
                    <img src={mediaPreviews[index]} alt={`Upload ${index + 1}`} className="w-full h-40 object-cover" />
                  ) : (
                    <div className="w-full h-40 flex items-center justify-center text-[#64748B]">📄 {file.name}</div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(index)}
                    aria-label="Remove media"
                    className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-full hover:bg-black/80 transition"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Code snippet - committed preview */}
          {codeSnippet && !showCodeEditor && (
            <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1E3447] bg-[#111E2B]">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                  {CODE_LANGUAGES.find((l) => l.id === codeSnippet.language)?.label || codeSnippet.language}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCodeDraft(codeSnippet.code);
                      setCodeLanguage(codeSnippet.language);
                      setShowCodeEditor(true);
                    }}
                    className="text-xs text-[#94A3B8] hover:text-[#00C8FF] transition"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveCodeSnippet}
                    className="text-xs text-[#94A3B8] hover:text-[#EF4444] transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <pre className="p-3 overflow-x-auto text-xs leading-relaxed text-[#94A3B8] font-mono max-h-40">
                <code>{codeSnippet.code}</code>
              </pre>
            </div>
          )}

          {/* Code snippet editor */}
          {showCodeEditor && (
            <div className="rounded-xl border border-[#00C8FF]/30 bg-[#0A111A] p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-[#94A3B8]">Language</label>
                <select
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#1E3447] bg-[#111E2B] text-sm text-[#F1F5F9] focus:outline-none focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF]"
                >
                  {CODE_LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={codeDraft}
                onChange={(e) => setCodeDraft(e.target.value)}
                placeholder="Paste or write your code here..."
                spellCheck={false}
                rows={8}
                className="w-full p-3 rounded-lg border border-[#1E3447] bg-[#060B12] text-[#E2E8F0] placeholder-[#64748B] font-mono text-xs leading-relaxed focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none resize-y"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCodeEditor(false);
                    setCodeDraft('');
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCodeSnippet}
                  disabled={!codeDraft.trim()}
                  className="px-3 py-1.5 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] text-[#060B12] rounded-lg hover:opacity-90 transition disabled:opacity-50"
                >
                  Add to Post
                </button>
              </div>
            </div>
          )}

          {/* Attachment buttons */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept={ALLOWED_MEDIA_TYPES.join(',')}
              multiple
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#94A3B8] hover:text-[#00C8FF] hover:bg-[#00C8FF]/10 rounded-xl transition"
            >
              <PhotoIcon className="h-4 w-4" />
              Image
            </button>
            <EmojiPicker onSelect={handleEmojiSelect} align="left" />
            <button
              type="button"
              onClick={() => setShowCodeEditor((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-xl transition ${
                showCodeEditor ? 'text-[#00C8FF] bg-[#00C8FF]/10' : 'text-[#94A3B8] hover:text-[#00C8FF] hover:bg-[#00C8FF]/10'
              }`}
            >
              <CodeBracketIcon className="h-4 w-4" />
              Code Snippet
            </button>
          </div>

          {/* Live preview */}
          {hasContent && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-2">Preview</p>
              <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-4">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-[#060B12]">{displayName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-[#F1F5F9] truncate">{displayName}</p>
                      <RoleBadge role={user?.role || 'student'} />
                    </div>
                    <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                      Just now • <selectedVisibility.icon className="h-3 w-3" /> {selectedVisibility.label}
                    </p>
                  </div>
                </div>

                {content.trim() && <PostContentBody content={content.trim()} className="text-sm text-[#CBD5E1]" />}

                {codeSnippet && (
                  <div className="mt-2">
                    <PostContentBody content={`\`\`\`${codeSnippet.language}\n${codeSnippet.code}\n\`\`\``} />
                  </div>
                )}

                {mediaPreviews.length > 0 && (
                  <div className={`mt-2.5 grid gap-1.5 ${getGridClasses(mediaPreviews.length)}`}>
                    {mediaPreviews.map((url, i) =>
                      isVideo(mediaFiles[i]) ? (
                        <video key={i} src={url} className="w-full h-28 object-cover rounded-lg" />
                      ) : (
                        <img key={i} src={url} alt="" className="w-full h-28 object-cover rounded-lg" />
                      )
                    )}
                  </div>
                )}

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#1E3447] text-[#64748B] text-xs">
                  <span>♡ Like</span>
                  <span>◌ Comment</span>
                  <span>↗ Share</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#1E3447] flex-shrink-0">
          <button
            onClick={() => !isBusy && onClose()}
            disabled={isBusy}
            className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasContent || isBusy}
            className="px-5 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : isLoading ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
