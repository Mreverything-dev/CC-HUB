// frontend/src/features/posts/components/ImageGrid.tsx
import { useRef, useState } from 'react';

const MAX_VISIBLE = 5;

interface ImageGridProps {
  images: string[];
  dark?: boolean;
  onImageClick?: (index: number) => void;
  onDoubleTap?: (clientX: number, clientY: number) => void;
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|avi|mkv)$/i.test(url) || url.includes('video');
}

export function ImageGrid({ images, dark = false, onImageClick, onDoubleTap }: ImageGridProps) {
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());

  const tapTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const lastTapRef = useRef<Map<number, number>>(new Map());

  if (!images || images.length === 0) return null;

  const total = images.length;
  const isSingle = total === 1;
  const overflowCount = total - MAX_VISIBLE;

  const displayOrder = images
    .map((_, i) => i)
    .sort((a, b) => Number(isVideoUrl(images[b])) - Number(isVideoUrl(images[a])));
  const visibleOrder = displayOrder.slice(0, MAX_VISIBLE);

  const tileBg = dark ? 'bg-[#0A111A]' : 'bg-gray-100';
  const placeholderText = dark ? 'text-[#64748B]' : 'text-gray-400';
  const gridHeight = 'h-56 sm:h-72 lg:h-96';

  const renderTile = (originalIndex: number, extraClass: string, showOverlay: boolean) => {
    const url = images[originalIndex];
    const broken = brokenUrls.has(url);
    const isVideoFile = isVideoUrl(url);
    const mediaClass = 'w-full h-full object-cover';

    const handleTileClick = (e: React.MouseEvent) => {
      e.stopPropagation();

      const now = Date.now();
      const last = lastTapRef.current.get(originalIndex) ?? 0;
      const timeSinceLastTap = now - last;

      if (timeSinceLastTap < 300) {
        const timer = tapTimersRef.current.get(originalIndex);
        if (timer) {
          clearTimeout(timer);
          tapTimersRef.current.delete(originalIndex);
        }
        lastTapRef.current.set(originalIndex, 0);
        onDoubleTap?.(e.clientX, e.clientY);
      } else {
        lastTapRef.current.set(originalIndex, now);
        const timer = setTimeout(() => {
          tapTimersRef.current.delete(originalIndex);
          if (showOverlay || (!broken && !isVideoFile)) {
            onImageClick?.(originalIndex);
          }
        }, 300);
        tapTimersRef.current.set(originalIndex, timer);
      }
    };

    return (
      <div
        key={originalIndex}
        className={`relative overflow-hidden rounded-xl ${tileBg} ${extraClass} select-none`}
        onClick={handleTileClick}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      >
        {broken ? (
          <div className={`flex h-full min-h-[120px] items-center justify-center p-4 text-center text-sm ${placeholderText}`}>
            🖼️ Media unavailable
          </div>
        ) : isVideoFile ? (
          <video
            src={url}
            className={mediaClass}
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setBrokenUrls((prev) => new Set(prev).add(url))}
          />
        ) : (
          <img
            src={url}
            alt={`Post media ${originalIndex + 1}`}
            className={mediaClass}
            loading="lazy"
            draggable={false}
            onError={() => setBrokenUrls((prev) => new Set(prev).add(url))}
          />
        )}

        {showOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-2xl font-semibold text-white">
            +{overflowCount}
          </div>
        )}
      </div>
    );
  };

  if (isSingle) {
    return (
      <div className="mt-3">
        <div className="relative w-full aspect-square overflow-hidden rounded-xl">
          {renderTile(visibleOrder[0], 'w-full h-full', false)}
        </div>
      </div>
    );
  }

  if (total === 2) {
    return (
      <div className={`mt-3 flex gap-2 ${gridHeight}`}>
        {visibleOrder.map((originalIndex) => renderTile(originalIndex, 'flex-1 h-full', false))}
      </div>
    );
  }

  if (total === 3) {
    return (
      <div className={`mt-3 flex gap-2 ${gridHeight}`}>
        {renderTile(visibleOrder[0], 'flex-1 h-full', false)}
        <div className="flex flex-1 min-h-0 flex-col gap-2">
          {renderTile(visibleOrder[1], 'w-full flex-1', false)}
          {renderTile(visibleOrder[2], 'w-full flex-1', false)}
        </div>
      </div>
    );
  }

  if (total === 4) {
    return (
      <div className={`mt-3 flex flex-col gap-2 ${gridHeight}`}>
        <div className="flex flex-1 min-h-0 gap-2">
          {renderTile(visibleOrder[0], 'flex-1 h-full', false)}
          {renderTile(visibleOrder[1], 'flex-1 h-full', false)}
        </div>
        <div className="flex flex-1 min-h-0 gap-2">
          {renderTile(visibleOrder[2], 'flex-1 h-full', false)}
          {renderTile(visibleOrder[3], 'flex-1 h-full', false)}
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-3 flex flex-col gap-2 ${gridHeight}`}>
      <div className="flex flex-1 min-h-0 gap-2">
        {renderTile(visibleOrder[0], 'flex-1 h-full', false)}
        {renderTile(visibleOrder[1], 'flex-1 h-full', false)}
      </div>
      <div className="flex flex-1 min-h-0 gap-2">
        {renderTile(visibleOrder[2], 'flex-1 h-full', false)}
        {renderTile(visibleOrder[3], 'flex-1 h-full', false)}
        {renderTile(visibleOrder[4], 'flex-1 h-full', overflowCount > 0)}
      </div>
    </div>
  );
}

export default ImageGrid;