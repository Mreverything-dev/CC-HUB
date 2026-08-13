// frontend/src/features/livestream/components/GoLiveModal.tsx
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSections } from '@/features/sections/hooks/useSections';
import { livestreamService } from '@/services/api/livestream.service';
import { StreamVisibility } from '@/types/livestream.types';
import { STREAM_CATEGORIES, categoryTag } from '../constants';
import { todayLocalIso } from '@/lib/formatters';
import toast from 'react-hot-toast';
import {
  XMarkIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  MicrophoneIcon,
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
} from '@heroicons/react/24/outline';

interface GoLiveModalProps {
  onClose: () => void;
  onStreamCreated: (streamId: string) => void;
}

const inputClassName =
  'w-full px-3.5 py-2.5 bg-[#0D1722] border border-[#1E3447] rounded-xl text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#00C8FF] focus:border-[#00C8FF] transition';

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

  // Advanced (informational only - see note below the section)
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Camera / mic
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState('');
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isProfessor = user?.role === 'professor';
  const isAdmin = user?.role === 'admin';
  const canTargetSection = isProfessor || isAdmin;

  // Professors only ever see sections they actually advise; admins keep
  // seeing every section (matches the backend's own get_sections rule) -
  // this is a defensive UI-layer filter only, the backend still enforces it.
  const availableSections = (sections || []).filter((s) => isAdmin || s.advisor_id === user?.id);

  useEffect(() => {
    refetchSections();
  }, []);

  // Stop the preview camera/mic if the modal is closed (Cancel, X, Escape,
  // or successful submit) while it's still running - otherwise the browser
  // keeps the camera light on with nothing referencing the stream anymore.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
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

  const startCamera = async (opts?: { videoDeviceId?: string; audioDeviceId?: string; mic?: boolean }) => {
    setCameraError(null);
    const micOn = opts?.mic ?? isMicOn;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: opts?.videoDeviceId ? { deviceId: { exact: opts.videoDeviceId } } : true,
        audio: micOn ? (opts?.audioDeviceId ? { deviceId: { exact: opts.audioDeviceId } } : true) : false,
      });

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraOn(true);

      const videoTrackId = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (videoTrackId) setSelectedVideoDeviceId(videoTrackId);
      const audioTrackId = stream.getAudioTracks()[0]?.getSettings().deviceId;
      if (audioTrackId) setSelectedAudioDeviceId(audioTrackId);

      await refreshDeviceList();
    } catch (error: any) {
      console.error('Camera access denied:', error);
      const message =
        error?.name === 'NotAllowedError'
          ? 'Camera/microphone access was denied. Allow access in your browser settings and try again.'
          : error?.name === 'NotFoundError'
          ? 'No camera or microphone was found on this device.'
          : 'Unable to access your camera. Please check your permissions.';
      setCameraError(message);
      toast.error(message);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraOn(false);
  };

  const toggleCamera = () => (isCameraOn ? stopCamera() : startCamera());

  const toggleMic = () => {
    const next = !isMicOn;
    setIsMicOn(next);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => (track.enabled = next));
    }
  };

  const handleVideoDeviceChange = (deviceId: string) => {
    setSelectedVideoDeviceId(deviceId);
    if (isCameraOn) startCamera({ videoDeviceId: deviceId, audioDeviceId: selectedAudioDeviceId });
  };

  const handleAudioDeviceChange = (deviceId: string) => {
    setSelectedAudioDeviceId(deviceId);
    if (isCameraOn) startCamera({ videoDeviceId: selectedVideoDeviceId, audioDeviceId: deviceId });
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
  const isFormValid = titleValid && sectionValid && scheduleValid;

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

      const response = await livestreamService.createStream(data);

      if (scheduleMode === 'later') {
        toast.success("Stream scheduled! Open it from Live Streams whenever you're ready to go live.");
        onClose();
      } else {
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

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50"
      onClick={() => !isLoading && onClose()}
    >
      <div
        className="bg-[#0D1722] w-full sm:max-w-3xl sm:rounded-2xl border border-[#1E3447] shadow-2xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-[#1E3447] flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#F1F5F9]">Create Live Stream</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">Set up your camera and stream details</p>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 p-4 sm:p-5">
            {/* LEFT: Camera preview */}
            <div className="space-y-3">
              <div className="relative bg-[#060B12] rounded-xl overflow-hidden aspect-video border border-[#1E3447]">
                {isCameraOn ? (
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-[#94A3B8] px-4">
                    <div className="text-center">
                      <VideoCameraSlashIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Camera is off</p>
                      {cameraError && (
                        <p className="text-xs text-[#EF4444] mt-2 flex items-center gap-1 justify-center">
                          <ExclamationTriangleIcon className="h-3.5 w-3.5 flex-shrink-0" />
                          {cameraError}
                        </p>
                      )}
                      <button
                        onClick={() => startCamera({ videoDeviceId: selectedVideoDeviceId, audioDeviceId: selectedAudioDeviceId })}
                        className="mt-3 px-4 py-2 bg-[#00C8FF] text-[#060B12] rounded-lg text-sm font-semibold hover:bg-[#00C8FF]/80 transition"
                      >
                        Start Camera
                      </button>
                    </div>
                  </div>
                )}

                {/* Controls overlay */}
                {isCameraOn && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#060B12]/80 backdrop-blur-sm rounded-xl p-1.5">
                    <button
                      onClick={toggleCamera}
                      title="Turn camera off"
                      aria-label="Turn camera off"
                      className="p-2 rounded-lg bg-[#00C8FF] text-[#060B12] hover:opacity-90 transition"
                    >
                      <VideoCameraIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={toggleMic}
                      title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                      aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                      className={`p-2 rounded-lg transition ${
                        isMicOn ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-[#1E3447] text-[#94A3B8]'
                      }`}
                    >
                      <MicrophoneIcon className="h-5 w-5" />
                    </button>
                  </div>
                )}

                {isCameraOn && (
                  <span className="absolute top-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E] text-[10px] font-bold uppercase tracking-wide">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                    Camera Ready
                  </span>
                )}
              </div>

              {/* Device selectors */}
              {(videoDevices.length > 0 || audioDevices.length > 0) && (
                <div className="space-y-2">
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

            {/* RIGHT: Stream settings */}
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
                      placeholder="Stream title *"
                      className={inputClassName}
                    />
                    {!titleValid && title.length === 0 && (
                      <p className="text-[11px] text-[#64748B] mt-1">Give viewers a clear idea of what this stream is about.</p>
                    )}
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
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
            className="flex items-center gap-2 px-6 py-2.5 bg-[#EF4444] text-white rounded-xl font-semibold text-sm hover:bg-[#EF4444]/80 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                {scheduleMode === 'later' ? 'Scheduling...' : 'Starting...'}
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
