// frontend/src/components/ui/YouTubeEmbed.tsx
import { useState } from 'react';
import { PlayIcon } from '@heroicons/react/24/solid';

interface YouTubeEmbedProps {
  videoId: string;
  className?: string;
}

export function YouTubeEmbed({ videoId, className = '' }: YouTubeEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className={`relative w-full aspect-video rounded-2xl overflow-hidden bg-black ${className}`}>
      {isPlaying ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsPlaying(true)}
          className="absolute inset-0 w-full h-full group"
        >
          <img
            src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
            alt="YouTube video thumbnail"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <span className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition flex items-center justify-center">
            <span className="flex items-center justify-center h-14 w-14 rounded-full bg-[#EF4444] group-hover:scale-110 transition-transform shadow-lg">
              <PlayIcon className="h-6 w-6 text-white ml-0.5" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}