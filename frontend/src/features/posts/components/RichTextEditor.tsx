// frontend/src/features/posts/components/RichTextEditor.tsx
import { useRef, useEffect, useCallback } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
}

const COLOR_PRESETS = [
  { hex: '#EF4444', label: 'Red' },
  { hex: '#F59E0B', label: 'Orange' },
  { hex: '#10B981', label: 'Green' },
  { hex: '#00C8FF', label: 'Cyan' },
  { hex: '#3B82F6', label: 'Blue' },
  { hex: '#8B5CF6', label: 'Purple' },
  { hex: '#EC4899', label: 'Pink' },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = "What's on your mind?",
  className = '',
  maxLength = 5000,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  // Sync external value → editor (only when not typing)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const exec = useCallback((command: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    isInternalChange.current = true;
    onChange(editorRef.current?.innerHTML || '');
  }, [onChange]);

  const handleInput = () => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    // Strip empty formatting on empty
    if (html === '<br>' || html === '<div><br></div>') {
      isInternalChange.current = true;
      onChange('');
      return;
    }
    isInternalChange.current = true;
    onChange(html);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const isEmpty = !value || value === '<br>' || value === '<div><br></div>';

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 mb-2 pb-2 border-b border-border/50 flex-wrap">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}
          title="Bold"
          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-glass-hover transition text-sm font-bold"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}
          title="Italic"
          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-glass-hover transition text-sm italic"
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); exec('strikeThrough'); }}
          title="Strikethrough"
          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-glass-hover transition text-sm line-through"
        >
          S
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); exec('underline'); }}
          title="Underline"
          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-glass-hover transition text-sm underline"
        >
          U
        </button>

        {/* Color picker */}
        <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-border/50">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); exec('foreColor', c.hex); }}
              title={c.label}
              className="w-5 h-5 rounded-full border border-border hover:scale-110 transition"
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>

        {/* Clear formatting */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); }}
          title="Clear formatting"
          className="ml-1 p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-glass-hover transition text-xs"
        >
          ✕
        </button>
      </div>

      {/* Editable area */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          data-placeholder={placeholder}
          className="min-h-[24px] max-h-[260px] overflow-y-auto text-sm text-text-primary focus:outline-none whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-text-muted"
        />
      </div>

      {/* Character counter */}
      <div className="flex items-center justify-end mt-1">
        <span className={`text-[11px] ${(value?.length || 0) >= maxLength ? 'text-[#EF4444]' : 'text-text-muted'}`}>
          {(value?.length || 0)} / {maxLength}
        </span>
      </div>
    </div>
  );
}