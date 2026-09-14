// frontend/src/features/posts/components/PostContentBody.tsx
import { MarkdownText } from './MarkdownText';

const CODE_FENCE_RE = /```(\w+)?\n?([\s\S]*?)```/g;

interface ContentSegment {
  type: 'text' | 'code';
  value: string;
  language?: string;
}

function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CODE_FENCE_RE.lastIndex = 0;

  while ((match = CODE_FENCE_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'code', value: match[2].replace(/\n$/, ''), language: match[1] || 'text' });
    lastIndex = CODE_FENCE_RE.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }
  return segments;
}

interface PostContentBodyProps {
  content: string;
  compact?: boolean;
  className?: string;
}

export function PostContentBody({ content, compact = false, className = '' }: PostContentBodyProps) {
  if (!content) return null;
  const segments = parseContent(content);

  // Plain text with no code fence - render with inline markdown
  if (segments.length === 1 && segments[0].type === 'text') {
    return (
      <p className={`whitespace-pre-wrap [overflow-wrap:anywhere] text-text-primary ${compact ? 'line-clamp-3' : ''} ${className}`}>
        <MarkdownText text={content} />
      </p>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {segments.map((seg, i) => {
        if (!seg.value.trim() && seg.type === 'text') return null;
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