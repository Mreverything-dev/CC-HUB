// frontend/src/features/posts/components/PostContentBody.tsx
import { MarkdownText } from './MarkdownText';

const CODE_FENCE_RE = /```(\w+)?\n?([\s\S]*?)```/g;
const YOUTUBE_RE =
  /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[\w-]{11}[^\s]*)/g;

interface ContentSegment {
  type: 'text' | 'code' | 'youtube';
  value: string;
  language?: string;
}

function getYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CODE_FENCE_RE.lastIndex = 0;

  while ((match = CODE_FENCE_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...splitTextAndYouTube(content.slice(lastIndex, match.index)));
    }
    segments.push({ type: 'code', value: match[2].replace(/\n$/, ''), language: match[1] || 'text' });
    lastIndex = CODE_FENCE_RE.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push(...splitTextAndYouTube(content.slice(lastIndex)));
  }
  return segments;
}

function splitTextAndYouTube(text: string): ContentSegment[] {
  const parts: ContentSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  YOUTUBE_RE.lastIndex = 0;

  while ((m = YOUTUBE_RE.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', value: text.slice(last, m.index) });
    }
    parts.push({ type: 'youtube', value: m[1] });
    last = YOUTUBE_RE.lastIndex;
  }
  if (last < text.length) {
    parts.push({ type: 'text', value: text.slice(last) });
  }
  return parts;
}

interface PostContentBodyProps {
  content: string;
  compact?: boolean;
  className?: string;
  /** When true, this is a text-only post (no media, no YouTube, no GIF).
   *  Renders the text larger + bold, FB-style. */
  textOnly?: boolean;
}

export function PostContentBody({ content, compact = false, className = '', textOnly = false }: PostContentBodyProps) {
  if (!content) return null;
  const segments = parseContent(content);

  // Plain text with no code fence and no YouTube - render with inline markdown
  if (segments.length === 1 && segments[0].type === 'text') {
    return (
      <p
        className={`whitespace-pre-wrap [overflow-wrap:anywhere] text-text-primary ${
          textOnly ? 'text-xl sm:text-2xl font-semibold leading-snug' : ''
        } ${compact ? 'line-clamp-3' : ''} ${className}`}
      >
        <MarkdownText text={content} />
      </p>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {segments.map((seg, i) => {
        if (!seg.value.trim() && seg.type === 'text') return null;

        if (seg.type === 'youtube') {
          const videoId = getYouTubeId(seg.value);
          if (!videoId) {
            return (
              <p key={i} className="whitespace-pre-wrap break-words text-text-primary">
                <MarkdownText text={seg.value} />
              </p>
            );
          }
          return (
            <div
              key={i}
              className="rounded-xl border border-border bg-glass overflow-hidden aspect-video"
            >
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
          );
        }

        if (seg.type === 'code') {
          return (
            <div
              key={i}
              className="rounded-xl border border-border bg-glass overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-glass-hover">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  {seg.language}
                </span>
              </div>
              <pre className={`p-3 overflow-x-auto text-xs leading-relaxed text-text-secondary font-mono ${compact ? 'max-h-28 overflow-y-hidden' : ''}`}>
                <code>{seg.value}</code>
              </pre>
            </div>
          );
        }

        return (
          <p key={i} className={`whitespace-pre-wrap break-words text-text-primary ${compact ? 'line-clamp-2' : ''}`}>
            <MarkdownText text={seg.value.trim()} />
          </p>
        );
      })}
    </div>
  );
}