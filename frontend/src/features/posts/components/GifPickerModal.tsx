// frontend/src/features/posts/components/GifPickerModal.tsx
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface GifPickerModalProps {
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function GifPickerModal({ onClose, onSelect, anchorRef }: GifPickerModalProps) {
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState<{ id: string; url: string; preview: string }[]>([]);
  const [gifSearchLoading, setGifSearchLoading] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute position based on the anchor element
  useEffect(() => {
    const computePosition = () => {
      const pickerWidth = 320;
      const pickerHeight = 420;

      if (!anchorRef?.current) {
        setPosition({ top: 100, left: window.innerWidth / 2 - pickerWidth / 2 });
        return;
      }
      const rect = anchorRef.current.getBoundingClientRect();

      // Positioned to the RIGHT of the anchor button (kagaya ng pic)
      let left = rect.right + 8;
      let top = rect.top - pickerHeight + rect.height;

      // Kung lalabas sa kanan ng viewport, ilipat sa kaliwa ng button
      if (left + pickerWidth > window.innerWidth - 8) {
        left = rect.left - pickerWidth - 8;
      }
      // Kung lalabas sa baba, i-anchor sa bottom ng viewport
      if (top + pickerHeight > window.innerHeight - 8) {
        top = window.innerHeight - pickerHeight - 8;
      }
      if (top < 8) top = 8;
      if (left < 8) left = 8;

      setPosition({ top, left });
    };

    computePosition();
    window.addEventListener('resize', computePosition);
    window.addEventListener('scroll', computePosition, true);
    return () => {
      window.removeEventListener('resize', computePosition);
      window.removeEventListener('scroll', computePosition, true);
    };
  }, [anchorRef]);

  // Close on outside click + Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        if (anchorRef?.current && anchorRef.current.contains(target)) return;
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, anchorRef]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GIPHY_API_KEY;
    if (!apiKey) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setGifSearchLoading(true);
      try {
        const endpoint = gifSearch.trim()
          ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(gifSearch.trim())}&limit=24&rating=pg-13`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=24&rating=pg-13`;
        const res = await fetch(endpoint, { signal: controller.signal });
        const data = await res.json();
        setGifResults(
          (data.data || []).map((g: any) => ({
            id: g.id,
            url: g.images?.original?.url || g.images?.fixed_height?.url,
            preview: g.images?.fixed_height_small?.url || g.images?.fixed_height?.url || g.images?.original?.url,
          }))
        );
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error('Giphy fetch error:', err);
      } finally {
        setGifSearchLoading(false);
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [gifSearch]);

  if (!position) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed z-[9999] w-[320px] rounded-2xl border border-border bg-bg shadow-2xl flex flex-col overflow-hidden"
      style={{ top: position.top, left: position.left, maxHeight: 'min(420px, 70vh)' }}
      role="dialog"
      aria-modal="false"
      aria-label="Choose a GIF"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <h3 className="text-xs font-semibold text-text-primary">Choose a GIF</h3>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-glass transition"
        >
          <XMarkIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2 border-b border-border flex-shrink-0">
        <input
          type="text"
          value={gifSearch}
          onChange={(e) => setGifSearch(e.target.value)}
          placeholder="Search Giphy..."
          autoFocus
          className="w-full px-3 py-1.5 rounded-lg border border-border bg-bg text-xs text-text-primary placeholder-text-muted focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none transition"
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto themed-scrollbar p-2">
        {gifSearchLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="animate-spin h-5 w-5 rounded-full border-2 border-border border-t-[#00C8FF]" />
            <p className="text-[10px] text-text-muted">Loading GIFs...</p>
          </div>
        ) : gifResults.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[11px] text-text-secondary">
              {gifSearch.trim() ? 'No GIFs found.' : 'No trending GIFs available.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {gifResults.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => {
                  onSelect(gif.url);
                  onClose();
                }}
                className="relative aspect-square overflow-hidden rounded-md border border-border bg-glass hover:border-[#00C8FF] transition"
              >
                <img src={gif.preview} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border flex-shrink-0">
        <a
          href="https://giphy.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-text-muted hover:text-[#00C8FF] transition-colors"
        >
          Powered by GIPHY
        </a>
        <button
          onClick={onClose}
          className="px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-glass rounded-lg transition"
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}