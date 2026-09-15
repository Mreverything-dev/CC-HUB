// frontend/src/features/livestream/components/GoLiveModal.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSections } from '@/features/sections/hooks/useSections';
import { livestreamService } from '@/services/api/livestream.service';
import { meethubService } from '@/services/api/meethub.service';
import { teachingAssignmentApi } from '@/services/api/teaching_assignment.service';
import { TeachingAssignment } from '@/types/section.types';
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
const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024;

interface GoLiveModalProps {
  onClose: () => void;
  onStreamCreated: (streamId: string) => void;
  variant?: 'livestream' | 'meethub';
}

const inputClassName =
  'w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-base sm:text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-border focus:border-border transition';

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
  unavailable: { label: 'Not started', dotClass: 'bg-text-muted', textClass: 'text-text-secondary' },
  'permission-required': { label: 'Permission required', dotClass: 'bg-[#EF4444]', textClass: 'text-[#EF4444]' },
};

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-glass border border-border text-text-primary text-[10px] font-bold flex-shrink-0">
        {n}
      </span>
      <label className="text-sm font-semibold text-text-primary">{children}</label>
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
          ? 'border-text-primary/40 bg-text-primary/10'
          : 'border-border bg-bg hover:border-text-primary/30 hover:bg-glass'
      }`}
    >
      <span className={`flex items-center gap-1.5 text-sm font-semibold ${active ? 'text-text-primary' : 'text-text-primary'}`}>
        {loading ? (
          <span className="h-4 w-4 rounded-full border-2 border-border border-t-text-primary animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
        {label}
      </span>
      <span className="text-[11px] text-text-muted leading-tight">{sublabel}</span>
    </button>
  );
}

function HealthDot({ label, state }: { label: string; state: HealthState }) {
  const meta = HEALTH_META[state];
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${meta.dotClass}`} />
      <span className="text-text-secondary">{label}</span>
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
        checked ? 'bg-[#22C55E]/70' : 'bg-border'
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  );
}

export default function GoLiveModal({ onClose, onStreamCreated, variant = 'livestream' }: GoLiveModalProps) {
  const isMeethub = variant === 'meethub';
  const { user } = useAuthStore();
  const { sections, refetch: refetchSections } = useSections();

  const [teachingAssignments, setTeachingAssignments] = useState<TeachingAssignment[]>([]);
  const [teachingAssignmentId, setTeachingAssignmentId] = useState('');
  const [entryDeadline, setEntryDeadline] = useState('');
  const [allowParticipantCamera, setAllowParticipantCamera] = useState(true);
  const [allowParticipantMic, setAllowParticipantMic] = useState(true);

  useEffect(() => {
    if (!isMeethub || user?.role !== 'professor') return;
    teachingAssignmentApi
      .getMine()
      .then((res) => setTeachingAssignments(res.data.filter((ta) => ta.status === 'active')))
      .catch(() => setTeachingAssignments([]));
  }, [isMeethub, user?.role]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  const [visibility, setVisibility] = useState<StreamVisibility>('public');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);

  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const [screenSourceType, setScreenSourceType] = useState<ScreenSourceKind | null>(null);
  const [isStartingScreen, setIsStartingScreen] = useState<ScreenSourceKind | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);

  const [isSystemAudioOn, setIsSystemAudioOn] = useState(false);
  const [systemAudioAvailable, setSystemAudioAvailable] = useState(false);

  const [pipPosition, setPipPosition] = useState<PipPosition>('bottom-right');
  const [pipSize, setPipSize] = useState<PipSize>('small');
  const [isPipMirrored, setIsPipMirrored] = useState(false);
  const [isPipHidden, setIsPipHidden] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const handedOffStreamsRef = useRef(false);
  const micAutoStartedRef = useRef(false);

  const isProfessor = user?.role === 'professor';
  const isAdmin = user?.role === 'admin';
  const canTargetSection = isProfessor || isAdmin;

  const availableSections = (sections || []).filter(
    (s) =>
      isAdmin ||
      s.advisor_id === user?.id ||
      s.teaching_assignments?.some((ta) => ta.professor_id === user?.id && ta.status === 'active')
  );

  useEffect(() => {
    refetchSections();
  }, []);

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

  useEffect(() => {
    return () => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setScreenSourceType(null);
    setSystemAudioAvailable(false);
    setIsSystemAudioOn(false);
  }, []);

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

      const hasSystemAudio = stream.getAudioTracks().length > 0;
      setSystemAudioAvailable(hasSystemAudio);
      setIsSystemAudioOn(hasSystemAudio);

      const [screenTrack] = stream.getVideoTracks();
      if (screenTrack) {
        screenTrack.onended = () => stopScreenShare();
      }
      maybeAutoStartMic();
    } catch (err: any) {
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

  const toggleSystemAudio = () => setIsSystemAudioOn((v) => !v);

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
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
  const isFormValid = titleValid && sectionValid && scheduleValid && (isMeethub || hasMediaSource);

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

      if (isMeethub) {
        data.teaching_assignment_id = teachingAssignmentId || null;
        data.allow_participant_camera = allowParticipantCamera;
        data.allow_participant_mic = allowParticipantMic;
        if (entryDeadline) data.entry_deadline = new Date(entryDeadline).toISOString();
      }

      const response = isMeethub
        ? await meethubService.createSession(data)
        : await livestreamService.createStream(data);
      const createdId = isMeethub ? (response.data as any).id : response.data.id;

      if (scheduleMode === 'later') {
        toast.success(
          isMeethub
            ? "Meeting scheduled! Open it from Meethub whenever you're ready to start."
            : "Stream scheduled! Open it from Live Streams whenever you're ready to go live."
        );
        onClose();
      } else {
        usePendingStreamStore.getState().setPendingStreams({
          cameraStream: cameraStreamRef.current,
          screenStream: screenStreamRef.current,
          micStream: micStreamRef.current,
          isMicOn,
          isSystemAudioOn: systemAudioAvailable && isSystemAudioOn,
          pipConfig: { position: pipPosition, size: pipSize, mirrored: isPipMirrored, hidden: isPipHidden },
        });
        handedOffStreamsRef.current = true;

        toast.success(isMeethub ? 'Meeting started!' : 'Stream created successfully!');
        onStreamCreated(createdId);
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
        className="bg-bg w-full sm:max-w-6xl sm:rounded-2xl border border-border shadow-2xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-text-primary">{isMeethub ? 'Start Meethub Meeting' : 'Go Live'}</h2>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-[11px] font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
              Setup
            </span>
          </div>
          <button
            onClick={() => !isLoading && onClose()}
            title="Close"
            aria-label="Close"
            className="p-1.5 hover:bg-glass rounded-lg transition disabled:opacity-40"
            disabled={isLoading}
          >
            <XMarkIcon className="h-5 w-5 text-text-secondary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto themed-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 p-4 sm:p-6">
            <div className="space-y-4 min-w-0">
              <div className="relative rounded-2xl overflow-hidden border border-border bg-bg aspect-video shadow-2xl">
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
                      <VideoCameraSlashIcon className="h-10 w-10 mx-auto mb-3 text-text-muted opacity-60" />
                      <p className="text-sm font-medium text-text-primary">Choose a video source</p>
                      <p className="text-xs text-text-muted mt-1">Start your camera or share your screen to preview your stream.</p>
                    </div>
                  </div>
                )}

                <div
                  className={`group/pip absolute ${PIP_POSITION_CLASSES[pipPosition]} ${PIP_SIZE_CLASSES[pipSize]} aspect-video rounded-xl overflow-hidden border-2 border-border bg-bg shadow-lg transition-opacity ${
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
                            pipPosition === pos ? 'bg-text-primary border-text-primary' : 'bg-white/10 border-white/30 hover:bg-white/25'
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
                        className={`p-1 rounded transition ${isPipMirrored ? 'bg-text-primary text-bg' : 'bg-white/10 text-white hover:bg-white/20'}`}
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
                    className={`absolute ${PIP_POSITION_CLASSES[pipPosition]} flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm text-white/70 hover:text-white text-[11px] font-medium transition`}
                  >
                    <EyeSlashIcon className="h-3.5 w-3.5" />
                    Camera hidden
                  </button>
                )}

                <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wide">
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

              <div>
                <p className="text-[11px] font-medium text-text-muted mb-1.5">Choose your video source</p>
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

              {isCameraOn && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-bg px-3.5 py-2.5">
                  <span className="text-xs font-medium text-text-secondary">
                    {screenSourceType ? 'Camera Size' : 'Camera Size (used when sharing your screen)'}
                  </span>
                  <div className="flex items-center gap-1">
                    {(['small', 'medium', 'large'] as PipSize[]).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setPipSize(size)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition ${
                          pipSize === size ? 'bg-text-primary text-bg' : 'text-text-secondary hover:bg-glass'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-bg p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-text-primary">
                    <MicrophoneIcon className={`h-4 w-4 ${isMicOn ? 'text-[#22C55E]' : 'text-text-muted'}`} />
                    Microphone
                    {micError && <span className="text-[11px] font-normal text-[#EF4444]">{micError}</span>}
                  </span>
                  <ToggleSwitch checked={isMicOn} onChange={toggleMic} disabled={isStartingMic} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-text-primary">
                    {systemAudioAvailable && isSystemAudioOn ? (
                      <SpeakerWaveIcon className="h-4 w-4 text-[#22C55E]" />
                    ) : (
                      <SpeakerXMarkIcon className="h-4 w-4 text-text-muted" />
                    )}
                    System Sound
                  </span>
                  {screenSourceType === null ? (
                    <span className="text-[11px] text-text-muted">Share your screen first</span>
                  ) : systemAudioAvailable ? (
                    <ToggleSwitch checked={isSystemAudioOn} onChange={toggleSystemAudio} />
                  ) : (
                    <span className="text-[11px] font-medium text-[#EF4444]">Unavailable</span>
                  )}
                </div>
                {screenSourceType !== null && !systemAudioAvailable && (
                  <p className="text-[11px] text-text-muted -mt-1.5">
                    System sound isn't available for this screen. The livestream will still work normally.
                  </p>
                )}

                {(videoDevices.length > 0 || audioDevices.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {videoDevices.length > 0 && (
                      <div>
                        <label htmlFor="camera-select" className="block text-[11px] font-medium text-text-muted mb-1">
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
                        <label htmlFor="mic-select" className="block text-[11px] font-medium text-text-muted mb-1">
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

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
                <HealthDot label="Camera" state={cameraHealth} />
                <HealthDot label="Microphone" state={micHealth} />
                <HealthDot label="Screen" state={screenHealth} />
                <HealthDot label="System Sound" state={systemAudioHealth} />
              </div>
            </div>

            <div className="space-y-5">
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
                      <p className="text-[11px] text-text-muted mt-1">Give viewers a clear idea of what this stream is about.</p>
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

                  <div>
                    <label className="block text-[11px] font-medium text-text-muted mb-1">Thumbnail (optional)</label>
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleThumbnailSelect}
                      className="hidden"
                    />
                    {thumbnailPreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-border aspect-video bg-bg">
                        <img src={thumbnailPreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => thumbnailInputRef.current?.click()}
                            className="px-2.5 py-1.5 bg-black/70 backdrop-blur-sm text-white text-xs font-medium rounded-lg hover:bg-black/90 transition"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveThumbnail}
                            title="Remove thumbnail"
                            aria-label="Remove thumbnail"
                            className="p-1.5 bg-black/70 backdrop-blur-sm text-[#EF4444] rounded-lg hover:bg-black/90 transition"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => thumbnailInputRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-1.5 py-5 rounded-xl border-2 border-dashed border-border text-text-muted hover:border-text-primary/40 hover:text-text-primary transition"
                      >
                        <PhotoIcon className="h-6 w-6" />
                        <span className="text-xs font-medium">Upload thumbnail</span>
                        <span className="text-[10px] text-text-muted">Recommended 1280×720 (16:9)</span>
                      </button>
                    )}
                    {thumbnailError && <p className="text-[11px] text-[#EF4444] mt-1">{thumbnailError}</p>}
                    <p className="text-[11px] text-text-muted mt-1">JPG, PNG, or WebP, up to 5MB.</p>
                  </div>
                </div>
              </div>

              <div>
                <StepLabel n={2}>Who Can Watch</StepLabel>
                <div className="flex gap-2 flex-wrap">
                  {visibilityOptions.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setVisibility(value)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                        visibility === value
                          ? 'bg-text-primary text-bg'
                          : 'bg-bg text-text-secondary border border-border hover:bg-glass'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {visibility === 'section' && (
                  <div className="mt-3">
                    <div className="space-y-1.5 max-h-36 overflow-y-auto themed-scrollbar bg-bg rounded-lg p-2 border border-border">
                      {availableSections.length === 0 ? (
                        <p className="text-sm text-text-secondary p-2">No sections found</p>
                      ) : (
                        availableSections.map((section) => (
                          <label
                            key={section.id}
                            className="flex items-center gap-3 p-2 hover:bg-glass rounded-lg cursor-pointer transition"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSections.includes(section.id)}
                              onChange={() => toggleSection(section.id)}
                              className="w-4 h-4 accent-text-primary"
                            />
                            <span className="text-sm text-text-primary">
                              {section.name}
                              {section.course && <span className="text-text-secondary ml-1">({section.course})</span>}
                            </span>
                            <span className="text-xs text-text-secondary ml-auto">{section.member_count || 0} students</span>
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
                              className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-glass border border-border text-text-primary text-xs font-medium"
                            >
                              {section.name}
                              <button
                                type="button"
                                onClick={() => toggleSection(id)}
                                aria-label={`Remove ${section.name}`}
                                className="hover:bg-glass-hover rounded-full p-0.5 transition"
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

              <div>
                <StepLabel n={3}>Schedule</StepLabel>
                <div className="flex gap-2">
                  <button
                    onClick={() => setScheduleMode('now')}
                    className={`flex-1 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                      scheduleMode === 'now'
                        ? 'bg-text-primary text-bg'
                        : 'bg-bg text-text-secondary border border-border hover:bg-glass'
                    }`}
                  >
                    Start Now
                  </button>
                  <button
                    onClick={() => setScheduleMode('later')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                      scheduleMode === 'later'
                        ? 'bg-text-primary text-bg'
                        : 'bg-bg text-text-secondary border border-border hover:bg-glass'
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
                        className={inputClassName}
                      />
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className={inputClassName}
                      />
                    </div>
                    <p className="text-[11px] text-text-muted">Timezone: {timezoneLabel}</p>
                    {!scheduleValid && (
                      <p className="text-[11px] text-[#EF4444]">Pick a date and time in the future.</p>
                    )}
                    <p className="text-[11px] text-text-muted">
                      We'll save this as a scheduled stream - start broadcasting anytime from Live Streams.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <StepLabel n={4}>Advanced Settings</StepLabel>
                  {showAdvanced ? (
                    <ChevronUpIcon className="h-4 w-4 text-text-muted" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 text-text-muted" />
                  )}
                </button>
                {showAdvanced && (
                  <div className="mt-2 space-y-2 bg-bg rounded-lg p-3 border border-border">
                    {[
                      { icon: ChatBubbleLeftRightIcon, label: 'Live chat' },
                      { icon: FaceSmileIcon, label: 'Viewer reactions' },
                      { icon: EyeIcon, label: 'Viewer count' },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm text-text-secondary">
                          <Icon className="h-4 w-4" />
                          {label}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-[10px] text-text-muted">Always on</span>
                          <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-[#22C55E]/30 cursor-not-allowed">
                            <span className="inline-block h-3.5 w-3.5 translate-x-4 rounded-full bg-[#22C55E]" />
                          </span>
                        </span>
                      </div>
                    ))}
                    <p className="text-[11px] text-text-muted pt-1">
                      Chat, reactions, and viewer count are enabled for every stream and can't be turned off per-stream yet.
                    </p>
                  </div>
                )}
              </div>

              {isMeethub && (
                <div>
                  <StepLabel n={5}>Meeting Settings</StepLabel>
                  <div className="space-y-3">
                    {user?.role === 'professor' && (
                      <div>
                        <label className="block text-[11px] font-medium text-text-muted mb-1">Official class (optional)</label>
                        <select
                          value={teachingAssignmentId}
                          onChange={(e) => setTeachingAssignmentId(e.target.value)}
                          className={inputClassName}
                        >
                          <option value="">No official class (unofficial meeting)</option>
                          {teachingAssignments.map((ta) => (
                            <option key={ta.id} value={ta.id}>
                              {ta.subject}
                              {ta.subject_code ? ` (${ta.subject_code})` : ''}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-text-muted mt-1">
                          Linking an official class enables attendance tracking for this meeting.
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-medium text-text-muted mb-1">Entry deadline (optional)</label>
                      <input
                        type="datetime-local"
                        value={entryDeadline}
                        onChange={(e) => setEntryDeadline(e.target.value)}
                        className={inputClassName}
                      />
                      <p className="text-[11px] text-text-muted mt-1">
                        Students can't join after this time. Anyone already in the meeting is never removed.
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-primary">Allow participants to use camera</span>
                      <ToggleSwitch checked={allowParticipantCamera} onChange={() => setAllowParticipantCamera((v) => !v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-primary">Allow participants to use microphone</span>
                      <ToggleSwitch checked={allowParticipantMic} onChange={() => setAllowParticipantMic((v) => !v)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-4 sm:px-5 py-4 border-t border-border bg-bg flex-shrink-0 sticky bottom-0">
          <button
            onClick={() => !isLoading && onClose()}
            disabled={isLoading}
            className="px-4 py-2.5 text-text-secondary hover:text-text-primary transition disabled:opacity-40"
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
                {scheduleMode === 'later' ? 'Scheduling...' : isMeethub ? 'Starting meeting...' : 'Starting livestream...'}
              </>
            ) : (
              <>
                {scheduleMode === 'later' ? (
                  <CalendarDaysIcon className="h-4 w-4" />
                ) : (
                  <CheckCircleIcon className="h-4 w-4" />
                )}
                {scheduleMode === 'later' ? 'Schedule Stream' : isMeethub ? 'Start Meeting' : 'Go Live'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}