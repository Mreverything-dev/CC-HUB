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

const ALLOWED_MEDIA_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
];

const MAX_CONTENT_LENGTH = 5000;

type Visibility = 'public' | 'friends' | 'section' | 'private';

const VISIBILITY_OPTIONS: { id: Visibility; label: string; icon: typeof GlobeAltIcon; description: string }[] = [
  { id: 'public', label: 'Public', icon: GlobeAltIcon, description: 'Anyone on CCS HUB can see this' },
  { id: 'friends', label: 'Friends', icon: UserGroupIcon, description: 'Only your friends' },
  { id: 'section', label: 'Section', icon: AcademicCapIcon, description: 'Only people in your section(s)' },
  { id: 'private', label: 'Private', icon: LockClosedIcon, description: 'Only you' },
];

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

  // Auto-resize textarea - minimum 1 line, maximum 260px
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minHeight = 24; // ~1 line at text-sm
    el.style.height = `${Math.max(minHeight, Math.min(el.scrollHeight, 260))}px`;
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
        className="w-full sm:max-w-xl max-h-[95vh] sm:max-h-[85vh] flex flex-col rounded-2xl border border-border bg-bg shadow-2xl overflow-hidden"
        style={{ animation: 'createPostModalIn 0.18s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-text-primary">Create Post</h2>
          <button
            onClick={() => !isBusy && onClose()}
            disabled={isBusy}
            aria-label="Close"
            className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-glass-hover transition disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body - just the preview card */}
        <div className="flex-1 overflow-y-auto themed-scrollbar px-5 py-4">
          <div className="rounded-xl border border-border bg-glass p-4">
            {/* Identity row */}
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] flex items-center justify-center overflow-hidden flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-[#060B12]">{displayName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-text-primary truncate">{displayName}</p>
                  <RoleBadge role={user?.role || 'student'} />
                </div>
                <div className="relative" ref={visibilityMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowVisibilityMenu((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={showVisibilityMenu}
                    className="flex items-center gap-1 -ml-1 px-1 py-0.5 rounded text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-glass-hover transition"
                  >
                    <selectedVisibility.icon className="h-3 w-3" />
                    {selectedVisibility.label}
                    <ChevronDownIcon className="h-3 w-3" />
                  </button>
                  {showVisibilityMenu && (
                    <div
                      role="menu"
                      className="absolute left-0 top-full mt-1 w-56 rounded-xl border border-border bg-bg shadow-xl py-1 z-20"
                    >
                      {VISIBILITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          role="menuitem"
                          onClick={() => {
                            setVisibility(opt.id);
                            setShowVisibilityMenu(false);
                          }}
                          className="flex items-start gap-2.5 w-full px-3 py-2 text-left hover:bg-glass-hover transition"
                        >
                          <opt.icon className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-text-primary">{opt.label}</p>
                            <p className="text-xs text-text-muted">{opt.description}</p>
                          </div>
                          {visibility === opt.id && <CheckIcon className="h-4 w-4 text-[#00C8FF] flex-shrink-0 mt-0.5" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Editable textarea - inside the preview card, auto-resize */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`rounded-xl border transition ${
                isDragging ? 'border-[#00C8FF] bg-[#00C8FF]/5' : 'border-transparent'
              }`}
            >
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT_LENGTH))}
                placeholder={`What's on your mind, ${displayName}?`}
                rows={1}
                className="w-full p-0 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none resize-none transition"
              />
            </div>
            <div className="flex items-center justify-end mt-1">
              <span className={`text-[11px] ${content.length >= MAX_CONTENT_LENGTH ? 'text-[#EF4444]' : 'text-text-muted'}`}>
                {content.length} / {MAX_CONTENT_LENGTH}
              </span>
            </div>

            {uploadError && (
              <div className="mt-2 p-2.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm">
                ❌ {uploadError}
              </div>
            )}

            {/* Code snippet - committed preview */}
            {codeSnippet && !showCodeEditor && (
              <div className="mt-2 rounded-xl border border-border bg-bg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-glass-hover">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
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
                      className="text-xs text-text-secondary hover:text-text-primary transition"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveCodeSnippet}
                      className="text-xs text-text-secondary hover:text-[#EF4444] transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <pre className="p-3 overflow-x-auto text-xs leading-relaxed text-text-secondary font-mono max-h-40">
                  <code>{codeSnippet.code}</code>
                </pre>
              </div>
            )}

            {/* Media preview */}
            {mediaPreviews.length > 0 && (
              <div className={`mt-2.5 grid gap-1.5 ${getGridClasses(mediaPreviews.length)}`}>
                {mediaFiles.map((file, index) => (
                  <div key={index} className="relative rounded-xl overflow-hidden bg-bg border border-border">
                    {isVideo(file) ? (
                      <video src={mediaPreviews[index]} className="w-full aspect-square object-cover" controls />
                    ) : isImage(file) ? (
                      <img
                        src={mediaPreviews[index]}
                        alt={`Upload ${index + 1}`}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center text-text-muted">
                        📄 {file.name}
                      </div>
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

            {/* Code snippet editor (inline) */}
            {showCodeEditor && (
              <div className="mt-2 rounded-xl border border-border bg-bg p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-text-secondary">Language</label>
                  <select
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-border bg-glass text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border focus:border-border"
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
                  rows={6}
                  className="w-full p-3 rounded-lg border border-border bg-glass text-text-primary placeholder-text-muted font-mono text-xs leading-relaxed focus:ring-1 focus:ring-border focus:border-border focus:outline-none resize-y"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCodeEditor(false);
                      setCodeDraft('');
                    }}
                    className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-glass-hover rounded-lg transition"
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

            {/* Actions preview row */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-text-muted text-xs">
              <span>♡ Like</span>
              <span>◌ Comment</span>
              <span>↗ Share</span>
            </div>
          </div>

          {/* Attachment buttons below the card */}
          <div className="flex items-center gap-1.5 flex-wrap mt-3">
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-glass-hover rounded-xl transition"
            >
              <PhotoIcon className="h-4 w-4" />
              Media
            </button>
            <EmojiPicker onSelect={handleEmojiSelect} align="left" />
            <button
              type="button"
              onClick={() => setShowCodeEditor((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-xl transition ${
                showCodeEditor
                  ? 'text-text-primary bg-glass'
                  : 'text-text-secondary hover:text-text-primary hover:bg-glass-hover'
              }`}
            >
              <CodeBracketIcon className="h-4 w-4" />
              Code Snippet
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={() => !isBusy && onClose()}
            disabled={isBusy}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-glass-hover rounded-xl transition disabled:opacity-50"
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