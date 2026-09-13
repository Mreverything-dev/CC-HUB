// frontend/src/lib/giphy.ts

/**
 * Detect a Giphy URL in a piece of text and return the GIF ID.
 * Supports:
 *   - https://giphy.com/gifs/{slug}-{id}
 *   - https://giphy.com/gifs/{id}
 *   - https://media.giphy.com/media/{id}/giphy.gif
 *   - https://i.giphy.com/media/{id}/giphy.gif
 * Returns null if no Giphy URL is found.
 */
export function extractGiphyId(text: string): string | null {
  if (!text) return null;

  // Giphy IDs are 13-14 chars of [A-Za-z0-9] (e.g. "IcGkqdUmYLFGE").
  const patterns = [
    // Page URL: https://giphy.com/gifs/IcGkqdUmYLFGE
    /giphy\.com\/gifs\/(?:[a-z0-9-]+-)?([A-Za-z0-9]{13,14})/i,
    // Direct media URL: https://media.giphy.com/media/{id}/giphy.gif
    /media\.giphy\.com\/media\/([A-Za-z0-9]{13,14})\//i,
    // i.giphy.com: https://i.giphy.com/media/{id}/giphy.gif
    /i\.giphy\.com\/media\/([A-Za-z0-9]{13,14})\//i,
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (match && match[1]) return match[1];
  }
  return null;
}

/**
 * Convert a Giphy ID into a direct GIF URL that can be rendered in <img>.
 * Uses media.giphy.com which serves the actual GIF bytes (no HTML page).
 */
export function giphyUrlFromId(id: string): string {
  return `https://media.giphy.com/media/${id}/giphy.gif`;
}

/**
 * Detect any Giphy URL in the text and return the direct GIF URL.
 * Returns null if no Giphy URL is found.
 */
export function extractGiphyGifUrl(text: string): string | null {
  const id = extractGiphyId(text);
  return id ? giphyUrlFromId(id) : null;
}

/**
 * Strip any Giphy URL from the text, so the same link doesn't show up
 * as both a plain link AND a rendered GIF.
 */
export function stripGiphyUrl(text: string): string {
  if (!text) return text;
  return text
    .replace(/https?:\/\/(?:www\.)?giphy\.com\/gifs\/[^\s]+/gi, '')
    .replace(/https?:\/\/media\.giphy\.com\/media\/[^\s]+/gi, '')
    .replace(/https?:\/\/i\.giphy\.com\/media\/[^\s]+/gi, '')
    .trim();
}