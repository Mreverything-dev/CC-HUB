// frontend/src/features/livestream/store/pendingStream.store.ts
import { create } from 'zustand';
import { PipConfig } from '../hooks/useLiveStreamSignaling';

interface PendingStreams {
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  /** Independently-acquired microphone audio, decoupled from the camera's
   * own video capture - lets a screen-only (camera-off) broadcast still
   * carry mic audio without ever having requested a camera track. */
  micStream: MediaStream | null;
  isMicOn: boolean;
  /** Whether the screen-share's system/desktop-audio track (if the browser
   * granted one) should be included in the broadcast - false whenever no
   * such track exists at all, so the signaling hook never has to
   * re-derive availability itself. */
  isSystemAudioOn: boolean;
  /** The camera PiP position/size/mirror chosen during Go Live setup, so
   * the live broadcast starts with the same overlay the host already saw
   * in their setup preview instead of resetting to a hardcoded default. */
  pipConfig: PipConfig;
}

interface PendingStreamState extends PendingStreams {
  setPendingStreams: (streams: PendingStreams) => void;
  /** One-shot read: returns whatever's stored and immediately clears it, so
   * the same camera/screen MediaStream objects can never be claimed (and
   * therefore attached to a second RTCPeerConnection/<video>) twice - the
   * caller that claims them now owns their lifecycle. A page refresh or a
   * direct link into /live/:id never populates this store at all, so
   * claiming it there just returns nulls - the existing fresh
   * getUserMedia() fallback in useLiveStreamSignaling is unchanged. */
  claimPendingStreams: () => PendingStreams;
}

const EMPTY: PendingStreams = {
  cameraStream: null,
  screenStream: null,
  micStream: null,
  isMicOn: true,
  isSystemAudioOn: false,
  pipConfig: { position: 'bottom-right', size: 'small', mirrored: false, hidden: false },
};

export const usePendingStreamStore = create<PendingStreamState>((set, get) => ({
  ...EMPTY,
  setPendingStreams: (streams) => set(streams),
  claimPendingStreams: () => {
    const { cameraStream, screenStream, micStream, isMicOn, isSystemAudioOn, pipConfig } = get();
    set(EMPTY);
    return { cameraStream, screenStream, micStream, isMicOn, isSystemAudioOn, pipConfig };
  },
}));
