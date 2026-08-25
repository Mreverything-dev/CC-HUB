// frontend/src/features/livestream/components/GoLiveModal.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSections } from '@/features/sections/hooks/useSections';
import { livestreamService } from '@/services/api/livestream.service';
import { mediaService } from '@/services/api/media.service';
import { usePendingStreamStore } from '../store/pendingStream.store';
import { StreamVisibility } from '@/types/livestream.types';
import { STREAM_CATEGORIES, categoryTag } from '../constants';
import { todayLocalIso } from '@/lib/formatters';
import toast from 'react-hot-toast';
import {
  XMarkIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ComputerDesktopIcon,
  WindowIcon,
  PuzzlePieceIcon,
  ArrowPathRoundedSquareIcon,
  EyeSlashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  GlobeAltIcon,
  UserIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  FaceSmileIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PhotoIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const ALLOWED_THUMBNAIL_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024; // 5MB

interface GoLiveModalProps {
  onClose: () => void;
  onStreamCreated: (streamId: string) => void;
}

const inputClassName =
  'w-full px-3.5 py-2.5 bg-[#0D1722] border border-[#1E3447] rounded-xl text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition';

type ScreenSourceKind = 'screen' | 'window' | 'game';
type PipPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type PipSize = 'small' | 'medium' | 'large';
type HealthState = 'ready' | 'initializing' | 'unavailable' | 'permission-required';

const PIP_POSITION_CLASSES: Record<PipPosition, string> = {
  'top-left': 'top-3 left-3',
  'top-right': 'top-3 right-3',
  'bottom-left': 'bottom-3 left-3',
  'bottom-right': 'bottom-3 right-3',
};
const PIP_SIZE_CLASSES: Record<PipSize, string> = {
  small: 'w-24 sm:w-28',
  medium: 'w-36 sm:w-40',
  large: 'w-48 sm:w-56',
};
const PIP_POSITION_LABELS: Record<PipPosition, string> = {
  'top-left': 'Top left',
  'top-right': 'Top right',
  'bottom-left': 'Bottom left',
  'bottom-right': 'Bottom right',
};

const HEALTH_META: Record<HealthState, { label: string; dotClass: string; textClass: string }> = {
  ready: { label: 'Ready', dotClass: 'bg-[#22C55E]', textClass: 'text-[#22C55E]' },
  initializing: { label: 'Initializing…', dotClass: 'bg-[#F59E0B] animate-pulse', textClass: 'text-[#F59E0B]' },
  unavailable: { label: 'Not started', dotClass: 'bg-[#64748B]', textClass: 'text-[#94A3B8]' },
  'permission-required': { label: 'Permission required', dotClass: 'bg-[#EF4444]', textClass: 'text-[#EF4444]' },
};

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#00C8FF]/15 border border-[#00C8FF]/30 text-[#00C8FF] text-[10px] font-bold flex-shrink-0">
        {n}
      </span>
      <label className="text-sm font-semibold text-[#F1F5F9]">{children}</label>
    </div>
  );
}

function SourceButton({
  icon: Icon,
  label,
  sublabel,
  active,
  loading,
  onClick,
}: {
  icon: typeof VideoCameraIcon;
  label: string;
  sublabel: string;
  active: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition ${
        active
          ? 'border-[#00C8FF]/50 bg-[#00C8FF]/10'
          : 'border-[#1E3447] bg-[#0A111A] hover:border-[#00C8FF]/30 hover:bg-[#162534]'
      }`}
    >
      <span className={`flex items-center gap-1.5 text-sm font-semibold ${active ? 'text-[#00C8FF]' : 'text-[#F1F5F9]'}`}>
        {loading ? (
          <span className="h-4 w-4 rounded-full border-2 border-[#64748B]/40 border-t-[#00C8FF] animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
        {label}
      </span>
      <span className="text-[11px] text-[#64748B] leading-tight">{sublabel}</span>
    </button>
  );
}

function HealthDot({ label, state }: { label: string; state: HealthState }) {
  const meta = HEALTH_META[state];
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${meta.dotClass}`} />
      <span className="text-[#94A3B8]">{label}</span>
      <span className={meta.textClass}>{meta.label}</span>
    </span>
  );
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-[#22C55E]/70' : 'bg-[#1E3447]'
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  );
}

export default function GoLiveModal({ onClose, onStreamCreated }: GoLiveModalProps) {
  const { user } = useAuthStore();
  const { sections, refetch: refetchSections } = useSections();

  // Stream info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  // Visibility
  const [visibility, setVisibility] = useState<StreamVisibility>('public');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);

  // Schedule
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Thumbnail
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Advanced (informational only - see note below the section)
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Camera / mic / screen are three fully independent local MediaStreams,
  // each with its own ref/lifecycle, so any one can be started, stopped, or
  // swapped without disturbing the others - in particular, the microphone is
  // never bundled into the camera's own getUserMedia() call, so "screen +
  // mic, camera off" never has to touch camera hardware at all.
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isStartingMic, setIsStartingMic] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState('');
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState('');

  // Screen / window / game share - one native Screen Capture API call
  // underlies all three; "Game" reuses it too (the browser's own picker),
  // no separate game-capture system exists or is invented here.
  const [screenSourceType, setScreenSourceType] = useState<ScreenSourceKind | null>(null);
  const [isStartingScreen, setIsStartingScreen] = useState<ScreenSourceKind | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);

  // System/desktop audio - piggybacks on the same getDisplayMedia() call as
  // the screen/window/game share above (there's no separate capture API for
  // it), so it can only ever be true once a share is active AND the browser
  // actually granted an audio track for the chosen source - never assumed.
  const [isSystemAudioOn, setIsSystemAudioOn] = useState(false);
  const [systemAudioAvailable, setSystemAudioAvailable] = useState(false);

  // Camera picture-in-picture (only relevant once a screen/window/game
  // source is primary and the camera is also on)
  const [pipPosition, setPipPosition] = useState<PipPosition>('bottom-right');
  const [pipSize, setPipSize] = useState<PipSize>('small');
  const [isPipMirrored, setIsPipMirrored] = useState(false);
  const [isPipHidden, setIsPipHidden] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  // Two independent MediaStreams and two stable <video> elements (main +
  // PiP) that are never conditionally unmounted - only their srcObject and
  // surrounding CSS change. Conditionally rendering/remounting a <video>
  // bound to a live stream reintroduces the exact "stuck on stale frame"
  // class of bug already fixed elsewhere in the livestream player, so this
  // preview deliberately avoids it from the start.
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  // Independent audio-only stream for the microphone - deliberately never
  // shares a getUserMedia() call with the camera (see startCamera/startMic),
  // so toggling either one never starts, stops, or restarts the other.
  const micStreamRef = useRef<MediaStream | null>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  // Set right before a successful "Go Live" hands these same MediaStream
  // objects to LiveStreamStage (via pendingStream.store) - the unmount
  // cleanup below must NOT stop tracks it no longer owns.
  const handedOffStreamsRef = useRef(false);
  // Mic defaults to "on" the first time the user starts ANY video source
  // (camera or screen), matching the previous camera+mic-together
  // convenience - but only ever auto-attempted once, so it never overrides
  // a mic the user has since explicitly turned off.
  const micAutoStartedRef = useRef(false);

  const isProfessor = user?.role === 'professor';
  const isAdmin = user?.role === 'admin';
  const canTargetSection = isProfessor || isAdmin;

  // Professors only ever see sections they actually teach - either as the
  // legacy sole advisor or via an active teaching assignment (co-professor);
  // admins keep seeing every section (matches the backend's own
  // get_sections rule) - this is a defensive UI-layer filter only, the
  // backend still enforces it.
  const availableSections = (sections || []).filter(
    (s) =>
      isAdmin ||
      s.advisor_id === user?.id ||
      s.teaching_assignments?.some((ta) => ta.professor_id === user?.id && ta.status === 'active')
  );

  useEffect(() => {
    refetchSections();
  }, []);

  // Stop every preview track (camera AND screen) if the modal is closed
  // (Cancel, X, Escape, or a "schedule for later" submit) while still
  // running - otherwise the browser keeps the camera light / share
  // indicator on with nothing referencing the streams anymore. Skipped when
  // going live immediately, since handleSubmit has already handed these
  // exact MediaStream objects to LiveStreamStage at that point - stopping
  // them here would kill the broadcast the instant this modal unmounts.
  useEffect(() => {
    return () => {
      if (handedOffStreamsRef.current) return;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    };
  }, []);

  // Revoke the local thumbnail preview object URL on unmount so it doesn't leak.
  useEffect(() => {
    return () => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes the modal, but never while a stream is being created.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, onClose]);

  const refreshDeviceList = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
      setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
    } catch {
      // Device labels just won't be available - not fatal.
    }
  };

  useEffect(() => {
    refreshDeviceList();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDeviceList);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDeviceList);
  }, []);

  // Whichever stream should currently occupy the MAIN preview slot (screen/
  // window/game if one is active, otherwise the camera) and the PiP slot
  // (camera, only when a screen source is primary) - re-assigned to the
  // SAME two stable <video> elements every time either source's on/off
  // state changes, instead of swapping which DOM node is mounted.
  useEffect(() => {
    const isScreenPrimary = screenSourceType !== null;
    const mainStream = isScreenPrimary ? screenStreamRef.current : cameraStreamRef.current;
    const pipStream = isScreenPrimary ? cameraStreamRef.current : null;

    if (mainVideoRef.current && mainVideoRef.current.srcObject !== mainStream) {
      mainVideoRef.current.srcObject = mainStream;
    }
    if (pipVideoRef.current && pipVideoRef.current.srcObject !== pipStream) {
      pipVideoRef.current.srcObject = pipStream;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraOn, screenSourceType]);

  const startCamera = async (opts?: { videoDeviceId?: string }) => {
    setCameraError(null);
    setIsStartingCamera(true);
    try {
      // Video only - the microphone is acquired completely separately (see
      // startMic) so this never has to be re-run just because the mic was
      // toggled, and stopping the camera never silently kills the mic too.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: opts?.videoDeviceId ? { deviceId: { exact: opts.videoDeviceId } } : true,
      });

      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = stream;
      setIsCameraOn(true);

      const videoTrackId = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (videoTrackId) setSelectedVideoDeviceId(videoTrackId);

      await refreshDeviceList();
      maybeAutoStartMic();
    } catch (error: any) {
      console.error('Camera access denied:', error);
      const message =
        error?.name === 'NotAllowedError'
          ? 'Camera access was denied. Allow access in your browser settings and try again.'
          : error?.name === 'NotFoundError'
          ? 'No camera was found on this device.'
          : 'Unable to access your camera. Please check your permissions.';
      setCameraError(message);
      toast.error(message);
    } finally {
      setIsStartingCamera(false);
    }
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setIsCameraOn(false);
  };

  const toggleCamera = () => (isCameraOn ? stopCamera() : startCamera());

  const startMic = async (opts?: { audioDeviceId?: string }) => {
    setMicError(null);
    setIsStartingMic(true);
    micAutoStartedRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: opts?.audioDeviceId ? { deviceId: { exact: opts.audioDeviceId } } : true,
      });

      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = stream;
      setIsMicOn(true);

      const audioTrackId = stream.getAudioTracks()[0]?.getSettings().deviceId;
      if (audioTrackId) setSelectedAudioDeviceId(audioTrackId);

      await refreshDeviceList();
    } catch (error: any) {
      console.error('Microphone access denied:', error);
      const message =
        error?.name === 'NotAllowedError'
          ? 'Microphone access was denied. Allow access in your browser settings and try again.'
          : error?.name === 'NotFoundError'
          ? 'No microphone was found on this device.'
          : 'Unable to access your microphone. Please check your permissions.';
      setMicError(message);
      setIsMicOn(false);
    } finally {
      setIsStartingMic(false);
    }
  };

  const stopMic = () => {
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    micAutoStartedRef.current = true;
    setIsMicOn(false);
  };

  const toggleMic = () => (isMicOn ? stopMic() : startMic());

  // Convenience only, matching the previous "camera turns on mic by
  // default" UX - fires at most once per modal session (see
  // micAutoStartedRef) and is a no-op if the user already made an explicit
  // choice about the mic before starting their first video source.
  const maybeAutoStartMic = () => {
    if (micAutoStartedRef.current) return;
    startMic();
  };

  const handleVideoDeviceChange = (deviceId: string) => {
    setSelectedVideoDeviceId(deviceId);
    if (isCameraOn) startCamera({ videoDeviceId: deviceId });
  };

  const handleAudioDeviceChange = (deviceId: string) => {
    setSelectedAudioDeviceId(deviceId);
    if (isMicOn) startMic({ audioDeviceId: deviceId });
  };

  const stopScreenShare = useCallback(() => {
    // .getTracks() covers the system-audio track too (it lives on this same
    // MediaStream, not a separate one) - stopping it here and resetting the
    // System Sound state below is the only cleanup it needs.
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setScreenSourceType(null);
    setSystemAudioAvailable(false);
    setIsSystemAudioOn(false);
  }, []);

  // Window/Game both use the exact same Screen Capture API as Screen - the
  // browser's own picker is what actually distinguishes "entire screen" vs
  // "a window" vs "a tab/app"; `displaySurface` is a best-effort hint some
  // browsers use to default the picker to the relevant tab, not a guarantee.
  // There is no separate "game capture" API, so Game intentionally reuses
  // this identical path with its own label rather than inventing one.
  const startScreenShare = async (kind: ScreenSourceKind) => {
    setScreenError(null);
    setIsStartingScreen(kind);
    try {
      const displaySurface = kind === 'screen' ? 'monitor' : 'window';
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface } as any,
        audio: true,
      });

      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = stream;
      setScreenSourceType(kind);

      // Whether the browser actually granted a system/desktop-audio track
      // for this particular screen/window/game - entirely up to the browser
      // and what the user picked in its share dialog, never guaranteed just
      // because audio: true was requested above. Defaults ON when available
      // (matches the microphone's own default-on convention); stays fully
      // OFF - never shown as active - when it isn't.
      const hasSystemAudio = stream.getAudioTracks().length > 0;
      setSystemAudioAvailable(hasSystemAudio);
      setIsSystemAudioOn(hasSystemAudio);

      const [screenTrack] = stream.getVideoTracks();
      if (screenTrack) {
        // Browser's native "Stop sharing" bar/button ends the track directly.
        screenTrack.onended = () => stopScreenShare();
      }
      maybeAutoStartMic();
    } catch (err: any) {
      // User cancelling the picker rejects the promise - not a real error.
      if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') {
        console.error('Screen share failed:', err);
      }
      setScreenError('Screen sharing was cancelled or permission was denied.');
    } finally {
      setIsStartingScreen(null);
    }
  };

  const toggleScreenShare = (kind: ScreenSourceKind) => {
    if (screenSourceType === kind) {
      stopScreenShare();
    } else {
      startScreenShare(kind);
    }
  };

  // Purely a preference flag, not a track mutation - kept separate from the
  // microphone's toggle (which does flip .enabled on its track directly)
  // because the live broadcast decides whether to actually mix this track in
  // based on this flag once handed off (see useLiveStreamSignaling), the
  // same way pipConfig.hidden is a flag rather than a track stop/start.
  const toggleSystemAudio = () => setIsSystemAudioOn((v) => !v);

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after Remove
    if (!file) return;

    if (!ALLOWED_THUMBNAIL_TYPES.includes(file.type)) {
      setThumbnailError('Only JPG, PNG, or WebP images are allowed.');
      return;
    }
    if (file.size > MAX_THUMBNAIL_SIZE) {
      setThumbnailError('Thumbnail must be smaller than 5MB.');
      return;
    }

    setThumbnailError(null);
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const handleRemoveThumbnail = () => {
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setThumbnailError(null);
  };

  const toggleSection = (sectionId: string) => {
    setSelectedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
    );
  };

  const isFutureSchedule = () => {
    if (!scheduledDate || !scheduledTime) return false;
    return new Date(`${scheduledDate}T${scheduledTime}`).getTime() > Date.now();
  };

  const sectionValid = visibility !== 'section' || selectedSections.length > 0;
  const scheduleValid = scheduleMode === 'now' || isFutureSchedule();
  const titleValid = title.trim().length > 0;
  const hasMediaSource = isCameraOn || screenSourceType !== null;
  const isFormValid = titleValid && sectionValid && scheduleValid && hasMediaSource;

  const timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const todayIso = todayLocalIso();

  const handleSubmit = async () => {
    if (!isFormValid || isLoading) return;

    setIsLoading(true);
    try {
      const trimmedDescription = description.trim();
      const finalDescription = category
        ? `${trimmedDescription}${trimmedDescription ? '\n\n' : ''}${categoryTag(category)}`
        : trimmedDescription || undefined;

      const data: any = {
        title: title.trim(),
        description: finalDescription,
        visibility,
      };
      if (visibility === 'section') data.target_section_ids = selectedSections;

      if (thumbnailFile) {
        try {
          const uploaded = await mediaService.uploadFiles([thumbnailFile]);
          data.thumbnail_url = uploaded.urls[0];
        } catch (uploadError: any) {
          toast.error(uploadError.response?.data?.detail || 'Failed to upload thumbnail');
          setIsLoading(false);
          return;
        }
      }

      const response = await livestreamService.createStream(data);

      if (scheduleMode === 'later') {
        toast.success("Stream scheduled! Open it from Live Streams whenever you're ready to go live.");
        onClose();
      } else {
        // Hand the already-acquired camera/screen streams straight to
        // LiveStreamStage instead of letting them get stopped on unmount and
        // re-acquired from scratch there - same MediaStream objects, no
        // second permission prompt, no risk of picking a different device.
        // Only for "start now": a scheduled stream may not actually go live
        // for a while, so there's nothing sensible to hand off here.
        usePendingStreamStore.getState().setPendingStreams({
          cameraStream: cameraStreamRef.current,
          screenStream: screenStreamRef.current,
          micStream: micStreamRef.current,
          isMicOn,
          isSystemAudioOn: systemAudioAvailable && isSystemAudioOn,
          pipConfig: { position: pipPosition, size: pipSize, mirrored: isPipMirrored, hidden: isPipHidden },
        });
        handedOffStreamsRef.current = true;

        toast.success('Stream created successfully!');
        onStreamCreated(response.data.id);
        onClose();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create stream');
    } finally {
      setIsLoading(false);
    }
  };

  const visibilityOptions: { value: StreamVisibility; label: string; icon: typeof GlobeAltIcon }[] = [
    { value: 'public', label: 'Public', icon: GlobeAltIcon },
    { value: 'friends', label: 'Friends Only', icon: UserIcon },
    ...(canTargetSection ? [{ value: 'section' as StreamVisibility, label: 'Specific Section', icon: UserGroupIcon }] : []),
  ];

  const showPip = screenSourceType !== null && isCameraOn && !isPipHidden;

  const cameraHealth: HealthState = isStartingCamera
    ? 'initializing'
    : isCameraOn
    ? 'ready'
    : cameraError?.includes('denied')
    ? 'permission-required'
    : 'unavailable';
  const micHealth: HealthState = isStartingMic
    ? 'initializing'
    : isMicOn
    ? 'ready'
    : micError?.includes('denied')
    ? 'permission-required'
    : 'unavailable';
  const screenHealth: HealthState = isStartingScreen
    ? 'initializing'
    : screenSourceType !== null
    ? 'ready'
    : screenError
    ? 'unavailable'
    : 'unavailable';
  const systemAudioHealth: HealthState =
    screenSourceType === null ? 'unavailable' : systemAudioAvailable && isSystemAudioOn ? 'ready' : 'unavailable';

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50"
      onClick={() => !isLoading && onClose()}
    >
      <div
        className="bg-[#0D1722] w-full sm:max-w-6xl sm:rounded-2xl border border-[#1E3447] shadow-2xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#1E3447] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-[#F1F5F9]">Go Live</h2>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-[11px] font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
              Setup
            </span>
          </div>
          <button
            onClick={() => !isLoading && onClose()}
            title="Close"
            aria-label="Close"
            className="p-1.5 hover:bg-[#1E3447] rounded-lg transition disabled:opacity-40"
            disabled={isLoading}
          >
            <XMarkIcon className="h-5 w-5 text-[#94A3B8]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto themed-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 p-4 sm:p-6">
            {/* LEFT: Preview studio */}
            <div className="space-y-4 min-w-0">
              {/* Preview container */}
              <div className="relative rounded-2xl overflow-hidden border border-[#1E3447] bg-[#060B12] aspect-video shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
                <video
                  ref={mainVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover ${hasMediaSource ? '' : 'hidden'}`}
                />

                {!hasMediaSource && (
                  <div className="absolute inset-0 flex items-center justify-center px-4">
                    <div className="text-center max-w-xs">
                      <VideoCameraSlashIcon className="h-10 w-10 mx-auto mb-3 text-[#64748B] opacity-60" />
                      <p className="text-sm font-medium text-[#F1F5F9]">Choose a video source</p>
                      <p className="text-xs text-[#64748B] mt-1">Start your camera or share your screen to preview your stream.</p>
                    </div>
                  </div>
                )}

                {/* Camera PiP overlay */}
                <div
                  className={`group/pip absolute ${PIP_POSITION_CLASSES[pipPosition]} ${PIP_SIZE_CLASSES[pipSize]} aspect-video rounded-xl overflow-hidden border-2 border-[#1E3447] bg-[#0A111A] shadow-lg transition-opacity ${
                    showPip ? '' : 'hidden'
                  }`}
                >
                  <video
                    ref={pipVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${isPipMirrored ? 'scale-x-[-1]' : ''}`}
                  />
                  {/* Hover toolbar */}
                  <div className="absolute inset-0 bg-black/55 opacity-0 group-hover/pip:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                    <div className="grid grid-cols-2 gap-1" role="group" aria-label="Camera position">
                      {(Object.keys(PIP_POSITION_CLASSES) as PipPosition[]).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setPipPosition(pos)}
                          title={PIP_POSITION_LABELS[pos]}
                          aria-label={PIP_POSITION_LABELS[pos]}
                          className={`h-3 w-3 rounded-sm border transition ${
                            pipPosition === pos ? 'bg-[#00C8FF] border-[#00C8FF]' : 'bg-white/10 border-white/30 hover:bg-white/25'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsPipMirrored((v) => !v)}
                        title="Mirror camera"
                        aria-label="Mirror camera"
                        className={`p-1 rounded transition ${isPipMirrored ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-white/10 text-white hover:bg-white/20'}`}
                      >
                        <ArrowPathRoundedSquareIcon className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsPipHidden(true)}
                        title="Hide camera"
                        aria-label="Hide camera"
                        className="p-1 rounded bg-white/10 text-white hover:bg-white/20 transition"
                      >
                        <EyeSlashIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {isPipHidden && isCameraOn && screenSourceType !== null && (
                  <button
                    type="button"
                    onClick={() => setIsPipHidden(false)}
                    className={`absolute ${PIP_POSITION_CLASSES[pipPosition]} flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#060B12]/85 backdrop-blur-sm text-[#94A3B8] hover:text-[#F1F5F9] text-[11px] font-medium transition`}
                  >
                    <EyeSlashIcon className="h-3.5 w-3.5" />
                    Camera hidden
                  </button>
                )}

                {/* Chrome */}
                <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#060B12]/80 backdrop-blur-sm text-[#F1F5F9] text-[10px] font-bold uppercase tracking-wide">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444] animate-pulse" />
                    Live Preview
                  </span>
                </div>
                {hasMediaSource && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E] text-[10px] font-bold uppercase tracking-wide pointer-events-none">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                    {screenSourceType ? `Sharing ${screenSourceType}` : 'Camera Ready'}
                  </div>
                )}

                {(cameraError || screenError) && (
                  <div className="absolute bottom-3 left-3 right-3 flex items-start gap-1.5 px-3 py-2 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-xs">
                    <ExclamationTriangleIcon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>{cameraError || screenError}</span>
                  </div>
                )}
              </div>

              {/* Video source selector */}
              <div>
                <p className="text-[11px] font-medium text-[#64748B] mb-1.5">Choose your video source</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <SourceButton
                    icon={VideoCameraIcon}
                    label="Camera"
                    sublabel="Use your webcam"
                    active={isCameraOn}
                    loading={isStartingCamera}
                    onClick={toggleCamera}
                  />
                  <SourceButton
                    icon={ComputerDesktopIcon}
                    label="Screen"
                    sublabel="Share your entire screen"
                    active={screenSourceType === 'screen'}
                    loading={isStartingScreen === 'screen'}
                    onClick={() => toggleScreenShare('screen')}
                  />
                  <SourceButton
                    icon={WindowIcon}
                    label="Window"
                    sublabel="Share an application window"
                    active={screenSourceType === 'window'}
                    loading={isStartingScreen === 'window'}
                    onClick={() => toggleScreenShare('window')}
                  />
                  <SourceButton
                    icon={PuzzlePieceIcon}
                    label="Game"
                    sublabel="Share your game window"
                    active={screenSourceType === 'game'}
                    loading={isStartingScreen === 'game'}
                    onClick={() => toggleScreenShare('game')}
                  />
                </div>
              </div>

              {/* Camera size control */}
              {isCameraOn && (
                <div className="flex items-center justify-between rounded-xl border border-[#1E3447] bg-[#0A111A] px-3.5 py-2.5">
                  <span className="text-xs font-medium text-[#94A3B8]">
                    {screenSourceType ? 'Camera Size' : 'Camera Size (used when sharing your screen)'}
                  </span>
                  <div className="flex items-center gap-1">
                    {(['small', 'medium', 'large'] as PipSize[]).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setPipSize(size)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition ${
                          pipSize === size ? 'bg-[#00C8FF] text-[#060B12]' : 'text-[#94A3B8] hover:bg-[#162534]'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Audio controls */}
              <div className="rounded-xl border border-[#1E3447] bg-[#0A111A] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-[#F1F5F9]">
                    <MicrophoneIcon className={`h-4 w-4 ${isMicOn ? 'text-[#22C55E]' : 'text-[#64748B]'}`} />
                    Microphone
                    {micError && <span className="text-[11px] font-normal text-[#EF4444]">{micError}</span>}
                  </span>
                  <ToggleSwitch checked={isMicOn} onChange={toggleMic} disabled={isStartingMic} />
                </div>

                {/* System sound - independent of the microphone above; both
                    can be on, off, or any combination (see
                    useLiveStreamSignaling, which mixes the two together for
                    the actual broadcast once live). Only ever shown as ON
                    when the browser actually granted an audio track for the
                    chosen screen/window/game - never assumed. */}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-[#F1F5F9]">
                    {systemAudioAvailable && isSystemAudioOn ? (
                      <SpeakerWaveIcon className="h-4 w-4 text-[#22C55E]" />
                    ) : (
                      <SpeakerXMarkIcon className="h-4 w-4 text-[#64748B]" />
                    )}
                    System Sound
                  </span>
                  {screenSourceType === null ? (
                    <span className="text-[11px] text-[#64748B]">Share your screen first</span>
                  ) : systemAudioAvailable ? (
                    <ToggleSwitch checked={isSystemAudioOn} onChange={toggleSystemAudio} />
                  ) : (
                    <span className="text-[11px] font-medium text-[#EF4444]">Unavailable</span>
                  )}
                </div>
                {screenSourceType !== null && !systemAudioAvailable && (
                  <p className="text-[11px] text-[#64748B] -mt-1.5">
                    System sound isn't available for this screen. The livestream will still work normally.
                  </p>
                )}

                {(videoDevices.length > 0 || audioDevices.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {videoDevices.length > 0 && (
                      <div>
                        <label htmlFor="camera-select" className="block text-[11px] font-medium text-[#64748B] mb-1">
                          Camera
                        </label>
                        <select
                          id="camera-select"
                          value={selectedVideoDeviceId}
                          onChange={(e) => handleVideoDeviceChange(e.target.value)}
                          className={inputClassName}
                        >
                          {videoDevices.map((d, i) => (
                            <option key={d.deviceId} value={d.deviceId}>
                              {d.label || `Camera ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {audioDevices.length > 0 && (
                      <div>
                        <label htmlFor="mic-select" className="block text-[11px] font-medium text-[#64748B] mb-1">
                          Microphone
                        </label>
                        <select
                          id="mic-select"
                          value={selectedAudioDeviceId}
                          onChange={(e) => handleAudioDeviceChange(e.target.value)}
                          className={inputClassName}
                        >
                          {audioDevices.map((d, i) => (
                            <option key={d.deviceId} value={d.deviceId}>
                              {d.label || `Microphone ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Stream health */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
                <HealthDot label="Camera" state={cameraHealth} />
                <HealthDot label="Microphone" state={micHealth} />
                <HealthDot label="Screen" state={screenHealth} />
                <HealthDot label="System Sound" state={systemAudioHealth} />
              </div>
            </div>

            {/* RIGHT: Stream Details panel */}
            <div className="space-y-5">
              {/* Step 1: Details */}
              <div>
                <StepLabel n={1}>Stream Details</StepLabel>
                <div className="space-y-3">
                  <div>
                    <input
                      id="stream-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="What are you streaming today?"
                      maxLength={100}
                      className={inputClassName}
                    />
                    {!titleValid && title.length === 0 && (
                      <p className="text-[11px] text-[#64748B] mt-1">Give viewers a clear idea of what this stream is about.</p>
                    )}
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell viewers what this livestream is about... (optional)"
                    rows={2}
                    maxLength={500}
                    className={`${inputClassName} resize-none`}
                  />
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClassName}>
                    <option value="">No category</option>
                    {STREAM_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>

                  {/* Thumbnail */}
                  <div>
                    <label className="block text-[11px] font-medium text-[#64748B] mb-1">Thumbnail (optional)</label>
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleThumbnailSelect}
                      className="hidden"
                    />
                    {thumbnailPreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-[#1E3447] aspect-video bg-[#060B12]">
                        <img src={thumbnailPreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => thumbnailInputRef.current?.click()}
                            className="px-2.5 py-1.5 bg-[#060B12]/80 backdrop-blur-sm text-[#F1F5F9] text-xs font-medium rounded-lg hover:bg-[#060B12] transition"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveThumbnail}
                            title="Remove thumbnail"
                            aria-label="Remove thumbnail"
                            className="p-1.5 bg-[#060B12]/80 backdrop-blur-sm text-[#EF4444] rounded-lg hover:bg-[#060B12] transition"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => thumbnailInputRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-1.5 py-5 rounded-xl border-2 border-dashed border-[#1E3447] text-[#64748B] hover:border-[#00C8FF]/40 hover:text-[#00C8FF] transition"
                      >
                        <PhotoIcon className="h-6 w-6" />
                        <span className="text-xs font-medium">Upload thumbnail</span>
                        <span className="text-[10px] text-[#64748B]">Recommended 1280×720 (16:9)</span>
                      </button>
                    )}
                    {thumbnailError && <p className="text-[11px] text-[#EF4444] mt-1">{thumbnailError}</p>}
                    <p className="text-[11px] text-[#64748B] mt-1">JPG, PNG, or WebP, up to 5MB.</p>
                  </div>
                </div>
              </div>

              {/* Step 2: Audience */}
              <div>
                <StepLabel n={2}>Who Can Watch</StepLabel>
                <div className="flex gap-2 flex-wrap">
                  {visibilityOptions.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setVisibility(value)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                        visibility === value
                          ? 'bg-[#00C8FF] text-[#060B12]'
                          : 'bg-[#0A111A] text-[#94A3B8] border border-[#1E3447] hover:bg-[#162534]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {visibility === 'section' && (
                  <div className="mt-3">
                    <div className="space-y-1.5 max-h-36 overflow-y-auto themed-scrollbar bg-[#0A111A] rounded-lg p-2 border border-[#1E3447]">
                      {availableSections.length === 0 ? (
                        <p className="text-sm text-[#94A3B8] p-2">No sections found</p>
                      ) : (
                        availableSections.map((section) => (
                          <label
                            key={section.id}
                            className="flex items-center gap-3 p-2 hover:bg-[#162534] rounded-lg cursor-pointer transition"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSections.includes(section.id)}
                              onChange={() => toggleSection(section.id)}
                              className="w-4 h-4 accent-[#00C8FF]"
                            />
                            <span className="text-sm text-[#F1F5F9]">
                              {section.name}
                              {section.course && <span className="text-[#94A3B8] ml-1">({section.course})</span>}
                            </span>
                            <span className="text-xs text-[#94A3B8] ml-auto">{section.member_count || 0} students</span>
                          </label>
                        ))
                      )}
                    </div>
                    {selectedSections.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedSections.map((id) => {
                          const section = availableSections.find((s) => s.id === id);
                          if (!section) return null;
                          return (
                            <span
                              key={id}
                              className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-[#00C8FF]/10 border border-[#00C8FF]/25 text-[#00C8FF] text-xs font-medium"
                            >
                              {section.name}
                              <button
                                type="button"
                                onClick={() => toggleSection(id)}
                                aria-label={`Remove ${section.name}`}
                                className="hover:bg-[#00C8FF]/20 rounded-full p-0.5 transition"
                              >
                                <XMarkIcon className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {!sectionValid && (
                      <p className="text-[11px] text-[#EF4444] mt-1.5">Select at least one section.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Step 3: Schedule */}
              <div>
                <StepLabel n={3}>Schedule</StepLabel>
                <div className="flex gap-2">
                  <button
                    onClick={() => setScheduleMode('now')}
                    className={`flex-1 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                      scheduleMode === 'now'
                        ? 'bg-[#00C8FF] text-[#060B12]'
                        : 'bg-[#0A111A] text-[#94A3B8] border border-[#1E3447] hover:bg-[#162534]'
                    }`}
                  >
                    Start Now
                  </button>
                  <button
                    onClick={() => setScheduleMode('later')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                      scheduleMode === 'later'
                        ? 'bg-[#00C8FF] text-[#060B12]'
                        : 'bg-[#0A111A] text-[#94A3B8] border border-[#1E3447] hover:bg-[#162534]'
                    }`}
                  >
                    <CalendarDaysIcon className="h-4 w-4" />
                    Schedule
                  </button>
                </div>

                {scheduleMode === 'later' && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={scheduledDate}
                        min={todayIso}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className={`${inputClassName} [color-scheme:dark]`}
                      />
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className={`${inputClassName} [color-scheme:dark]`}
                      />
                    </div>
                    <p className="text-[11px] text-[#64748B]">Timezone: {timezoneLabel}</p>
                    {!scheduleValid && (
                      <p className="text-[11px] text-[#EF4444]">Pick a date and time in the future.</p>
                    )}
                    <p className="text-[11px] text-[#64748B]">
                      We'll save this as a scheduled stream - start broadcasting anytime from Live Streams.
                    </p>
                  </div>
                )}
              </div>

              {/* Step 4: Advanced settings */}
              <div>
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <StepLabel n={4}>Advanced Settings</StepLabel>
                  {showAdvanced ? (
                    <ChevronUpIcon className="h-4 w-4 text-[#64748B]" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 text-[#64748B]" />
                  )}
                </button>
                {showAdvanced && (
                  <div className="mt-2 space-y-2 bg-[#0A111A] rounded-lg p-3 border border-[#1E3447]">
                    {[
                      { icon: ChatBubbleLeftRightIcon, label: 'Live chat' },
                      { icon: FaceSmileIcon, label: 'Viewer reactions' },
                      { icon: EyeIcon, label: 'Viewer count' },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm text-[#94A3B8]">
                          <Icon className="h-4 w-4" />
                          {label}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[#64748B]">Always on</span>
                          <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-[#22C55E]/30 cursor-not-allowed">
                            <span className="inline-block h-3.5 w-3.5 translate-x-4 rounded-full bg-[#22C55E]" />
                          </span>
                        </span>
                      </div>
                    ))}
                    <p className="text-[11px] text-[#64748B] pt-1">
                      Chat, reactions, and viewer count are enabled for every stream and can't be turned off per-stream yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-4 sm:px-5 py-4 border-t border-[#1E3447] bg-[#0D1722] flex-shrink-0 sticky bottom-0">
          <button
            onClick={() => !isLoading && onClose()}
            disabled={isLoading}
            className="px-4 py-2.5 text-[#94A3B8] hover:text-[#F1F5F9] transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !isFormValid}
            title={!hasMediaSource ? 'Start your camera or share your screen first' : undefined}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#EF4444] text-white rounded-xl font-semibold text-sm hover:bg-[#EF4444]/80 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                {scheduleMode === 'later' ? 'Scheduling...' : 'Starting livestream...'}
              </>
            ) : (
              <>
                {scheduleMode === 'later' ? (
                  <CalendarDaysIcon className="h-4 w-4" />
                ) : (
                  <CheckCircleIcon className="h-4 w-4" />
                )}
                {scheduleMode === 'later' ? 'Schedule Stream' : 'Go Live'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
