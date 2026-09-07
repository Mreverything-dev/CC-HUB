// frontend/src/features/posts/components/ImageGrid.tsx
import { useState } from 'react';

const MAX_VISIBLE = 5;

interface ImageGridProps {
  /** Post media URLs (images and/or videos, same array as media_urls). */
  images: string[];
  dark?: boolean;
  /** Called with the item's real index in `images` - used by the caller to open its own lightbox/viewer. */
  onImageClick?: (index: number) => void;
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|avi|mkv)$/i.test(url) || url.includes('video');
}

export function ImageGrid({ images, dark = false, onImageClick }: ImageGridProps) {
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());

  if (!images || images.length === 0) return null;

  const total = images.length;
  const isSingle = total === 1;
  const overflowCount = total - MAX_VISIBLE;

  // Videos always display first - a stable sort so relative order within
  // "all videos" and within "all images" is otherwise unchanged. This
  // reorders which tile each item lands in, but `onImageClick` and every
  // `alt`/`key` below still use the item's ORIGINAL index into `images`,
  // so the caller's lightbox (which navigates the untouched media_urls
  // array) keeps working exactly as before.
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
    const mediaClass = isSingle
      ? 'w-full h-auto max-h-[500px] object-contain'
      : 'w-full h-full object-cover';

    const handleTileClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Videos already autoplay muted with their own native controls for
      // sound/pause/fullscreen, so a plain click doesn't also open the
      // lightbox - except the overflow tile, where the "+X" overlay's
      // whole point is "there's more to see", so it always opens the
      // viewer regardless of what the last visible tile happens to be.
      if (showOverlay || (!broken && !isVideoFile)) {
        onImageClick?.(originalIndex);
      }
    };

    return (
      <div
        key={originalIndex}
        className={`relative overflow-hidden rounded-xl ${tileBg} ${extraClass}`}
        onClick={handleTileClick}
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
            className={`${mediaClass} cursor-zoom-in`}
            loading="lazy"
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

  // Single item - full width, full aspect always visible, never cropped.
  if (isSingle) {
    return <div className="mt-3">{renderTile(visibleOrder[0], 'w-full', false)}</div>;
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
        {/* min-h-0 overrides the flex default of min-height:auto, which
            otherwise sizes this column to its tallest image's intrinsic
            height instead of shrinking to share the row's fixed height. */}
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

  // 5 or more: 2 on top, 3 on bottom - the last (5th) tile carries the
  // "+X" overlay whenever there are more than 5 items in total.
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
