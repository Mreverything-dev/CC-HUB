// frontend/src/features/livestream/utils/meetingSounds.ts
// Short, synthesized notification chimes for Meethub - no audio asset
// files and no external library, built entirely on the native Web Audio
// API (nothing like this exists anywhere else in the app to reuse). Every
// tone is well under 300ms and quiet by design so a long meeting never
// becomes noisy.

let sharedContext: AudioContext | null = null;
let unlocked = false;

/**
 * Single shared AudioContext for everything audio-related in Meethub - both
 * these notification chimes and useIsSpeaking's live analysers. One context
 * per room instead of one per consumer, and one place that needs unlocking.
 */
export function getMeetingAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) sharedContext = new Ctor();
  return sharedContext;
}

/**
 * Must be called from inside a real user-gesture handler (click/tap/key) to
 * satisfy the browser's autoplay policy - MeethubRoom wires this to the
 * first interaction anywhere in the meeting UI. Safe to call repeatedly or
 * outside a gesture (silently does nothing useful in that case).
 */
export function unlockMeetingSounds() {
  if (unlocked) return;
  const ctx = getMeetingAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  unlocked = true;
}

function playTone(freqs: number[], durationMs: number, volume = 0.07) {
  const ctx = getMeetingAudioContext();
  // Not unlocked yet (no user gesture so far) - stay silent rather than
  // throwing or queuing anything up.
  if (!ctx || ctx.state === 'suspended') return;
  const now = ctx.currentTime;
  const step = durationMs / 1000 / freqs.length;
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * step;
    const end = start + step;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + step * 0.15);
    gain.gain.linearRampToValueAtTime(0, end);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  });
}

export const meetingSounds = {
  /** Meeting successfully started/joined - upbeat three-note rise. */
  start: () => playTone([523.25, 659.25, 783.99], 260, 0.09),
  /** A participant joined - subtle two-note blip. */
  join: () => playTone([659.25, 880], 140, 0.06),
  /** A participant left - subtle descending blip. */
  leave: () => playTone([523.25, 392], 160, 0.06),
  /** A student raised their hand (organizer only). */
  speakRequest: () => playTone([880, 1046.5], 180, 0.08),
  /** Attendance was updated - very subtle single tone. */
  attendanceUpdate: () => playTone([740], 120, 0.05),
};
