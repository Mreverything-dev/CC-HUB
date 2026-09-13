// frontend/src/lib/youtube.ts

/**
 * Detect a YouTube video URL in a piece of text and return the video ID.
 * Supports:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtube.com/watch?v=VIDEO_ID
 *   - https://m.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - https://www.youtube.com/shorts/VIDEO_ID
 *   - https://www.youtube.com/live/VIDEO_ID
 * Also handles URLs with extra query parameters (e.g. &si=..., ?t=...).
 * Returns null if no YouTube URL is found.
 */
export function extractYouTubeId(text: string): string | null {
  if (!text) return null;

  // YouTube video IDs are exactly 11 chars of [A-Za-z0-9_-].
  // We anchor on exactly 11 chars followed by a non-ID char (or end of string)
  // so we don't match the extra `?si=...` / `&t=...` params.
  const ID = '([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])';

  const patterns = [
    new RegExp(`(?:https?:\\/\\/)?(?:www\\.|m\\.)?youtube\\.com\\/watch\\?(?:[^\\s]*&)?v=${ID}`, 'i'),
    new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?youtu\\.be\\/${ID}`, 'i'),
    new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?youtube\\.com\\/embed\\/${ID}`, 'i'),
    new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?youtube\\.com\\/shorts\\/${ID}`, 'i'),
    new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?youtube\\.com\\/live\\/${ID}`, 'i'),
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (match && match[1]) return match[1];
  }
  return null;
}

/**
 * Remove any YouTube URL from the text, so the same link doesn't show up
 * as both a hyperlink AND an embedded player.
 */
export function stripYouTubeUrl(text: string): string {
  if (!text) return text;
  const ID = '[A-Za-z0-9_-]{11}';
  return text
    .replace(new RegExp(`(?:https?:\\/\\/)?(?:www\\.|m\\.)?youtube\\.com\\/watch\\?(?:[^\\s]*&)?v=${ID}\\S*`, 'gi'), '')
    .replace(new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?youtu\\.be\\/${ID}\\S*`, 'gi'), '')
    .replace(new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?youtube\\.com\\/embed\\/${ID}\\S*`, 'gi'), '')
    .replace(new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?youtube\\.com\\/shorts\\/${ID}\\S*`, 'gi'), '')
    .replace(new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?youtube\\.com\\/live\\/${ID}\\S*`, 'gi'), '')
    .trim();
}