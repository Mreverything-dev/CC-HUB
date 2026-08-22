// frontend/src/features/livestream/store/pendingStream.store.ts
import { create } from 'zustand';
import { PipConfig } from '../hooks/useLiveStreamSignaling';

interface PendingStreams {
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  isMicOn: boolean;
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
  isMicOn: true,
  pipConfig: { position: 'bottom-right', size: 'small', mirrored: false, hidden: false },
};

export const usePendingStreamStore = create<PendingStreamState>((set, get) => ({
  ...EMPTY,
  setPendingStreams: (streams) => set(streams),
  claimPendingStreams: () => {
    const { cameraStream, screenStream, isMicOn, pipConfig } = get();
    set(EMPTY);
    return { cameraStream, screenStream, isMicOn, pipConfig };
  },
}));
