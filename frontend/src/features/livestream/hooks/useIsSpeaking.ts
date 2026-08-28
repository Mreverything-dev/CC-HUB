// frontend/src/features/livestream/hooks/useIsSpeaking.ts
import { useEffect, useRef, useState } from 'react';
import { getMeetingAudioContext } from '../utils/meetingSounds';

// Byte-domain deviation from the 128 silence midpoint required to count as
// "talking". Deliberately low - real speech has far more dynamic range than
// this floor, and a pulse that's a little too eager beats one that misses
// quieter speakers or soft-spoken moments.
const SPEAKING_THRESHOLD = 2;
const HANGOVER_MS = 300; // keeps the pulse on briefly through short gaps in speech, avoids flicker

/**
 * True while real audio energy is present on `track` (someone is actually
 * talking, not just "mic is on"). Used to drive Meethub's per-tile speaking
 * pulse - works for both the local self track and any remote track, since
 * analysis reads straight from the MediaStreamTrack and is independent of
 * whether the tile's <video> element itself is muted for playback.
 */
export function useIsSpeaking(track: MediaStreamTrack | null): boolean {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);

  useEffect(() => {
    if (!track || track.kind !== 'audio') {
      setIsSpeaking(false);
      return;
    }
    const ctx = getMeetingAudioContext();
    if (!ctx) return;

    let source: MediaStreamAudioSourceNode;
    let analyser: AnalyserNode;
    try {
      source = ctx.createMediaStreamSource(new MediaStream([track]));
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
    } catch {
      // A track that's ending/invalid at this exact instant - just stay silent.
      return;
    }

    const data = new Uint8Array(analyser.fftSize);
    let lastLoudAt = 0;

    // setInterval, not requestAnimationFrame - rAF is throttled/paused for a
    // backgrounded or unfocused tab (common in a multi-window meeting, e.g.
    // when a participant switches to another app), which would silently stop
    // detecting speech for anyone not currently the focused window.
    const intervalId = window.setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let maxDeviation = 0;
      for (let i = 0; i < data.length; i++) {
        const dev = Math.abs(data[i] - 128);
        if (dev > maxDeviation) maxDeviation = dev;
      }
      const now = performance.now();
      if (track.enabled && maxDeviation > SPEAKING_THRESHOLD) {
        lastLoudAt = now;
      }
      const next = now - lastLoudAt < HANGOVER_MS;
      if (next !== isSpeakingRef.current) {
        isSpeakingRef.current = next;
        setIsSpeaking(next);
      }
    }, 100);

    return () => {
      window.clearInterval(intervalId);
      source.disconnect();
      analyser.disconnect();
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    };
  }, [track]);

  return isSpeaking;
}
