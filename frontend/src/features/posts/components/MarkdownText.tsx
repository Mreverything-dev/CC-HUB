// frontend/src/features/posts/components/MarkdownText.tsx
import React from 'react';

interface MarkdownTextProps {
  text: string;
  className?: string;
}

// Color: [[color:#HEX]]text[[/color]] — strict 6-char hex
const COLOR_RE = /\[\[color:#([0-9A-Fa-f]{6})\]\]([\s\S]*?)\[\[\/color\]\]/g;

// Markdown inline: **bold**, *italic*, ~~strike~~, `code`
const MD_RE = /(\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|`[^`]+`)/g;

function parseMarkdown(text: string, keyPrefix: string = 'md'): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  MD_RE.lastIndex = 0;
  while ((match = MD_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const uniqueKey = `${keyPrefix}-${key++}`;
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={uniqueKey}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      parts.push(<del key={uniqueKey}>{token.slice(2, -2)}</del>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={uniqueKey}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={uniqueKey}
          className="px-1.5 py-0.5 rounded bg-glass border border-border text-[0.9em] font-mono"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      parts.push(token);
    }

    lastIndex = MD_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  COLOR_RE.lastIndex = 0;
  while ((match = COLOR_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      // Text before color marker — parse as Markdown (use prefixed keys)
      const beforeParts = parseMarkdown(text.slice(lastIndex, match.index));
      beforeParts.forEach((part) => parts.push(part));
    }

    const hex = match[1];
    const innerText = match[2];
    parts.push(
      <span key={`color-${key++}-${hex}`} style={{ color: `#${hex}` }}>
        {parseMarkdown(innerText, `color-${key}`)}
      </span>
    );

    lastIndex = COLOR_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(...parseMarkdown(text.slice(lastIndex)));
  }

  return parts;
}

export function MarkdownText({ text, className = '' }: MarkdownTextProps) {
  if (!text) return null;
  const parts = parseInline(text);
  return <span className={className}>{parts}</span>;
}