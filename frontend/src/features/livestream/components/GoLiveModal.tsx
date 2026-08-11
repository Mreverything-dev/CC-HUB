// frontend/src/features/livestream/components/GoLiveModal.tsx
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSections } from '@/features/sections/hooks/useSections';
import { livestreamService } from '@/services/api/livestream.service';
import { StreamVisibility } from '@/types/livestream.types';
import toast from 'react-hot-toast';
import { XMarkIcon, VideoCameraIcon, MicrophoneIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';

interface GoLiveModalProps {
  onClose: () => void;
  onStreamCreated: (streamId: string) => void;
}

export default function GoLiveModal({ onClose, onStreamCreated }: GoLiveModalProps) {
  const { user } = useAuthStore();
  const { sections, refetch: refetchSections } = useSections();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<StreamVisibility>('public');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [showSectionSelector, setShowSectionSelector] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isProfessor = user?.role === 'professor';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    refetchSections();
  }, []);

  // Stop the preview camera/mic if the modal is closed (Cancel, X, or
  // successful submit) while it's still running - otherwise the browser
  // keeps the camera light on with nothing referencing the stream anymore.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: isMicOn });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOn(true);
    } catch (error) {
      console.error('Camera access denied:', error);
      toast.error('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  };

  const toggleCamera = () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const toggleMic = () => {
    setIsMicOn(!isMicOn);
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(track => track.enabled = !isMicOn);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter a stream title');
      return;
    }

    if (visibility === 'section' && selectedSections.length === 0) {
      toast.error('Please select at least one section');
      return;
    }

    setIsLoading(true);
    try {
      const data: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
      };

      if (visibility === 'section') {
        data.target_section_ids = selectedSections;
      }

      const response = await livestreamService.createStream(data);
      toast.success('Stream created successfully!');
      onStreamCreated(response.data.id);
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create stream');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setSelectedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const professorSections = sections || [];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-[#0A111A] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#1E3447] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1E3447]">
          <h2 className="text-xl font-bold text-[#F1F5F9]">Go Live</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#1E3447] rounded-lg transition"
          >
            <XMarkIcon className="h-6 w-6 text-[#94A3B8]" />
          </button>
        </div>

        {/* Camera Preview */}
        <div className="p-4 border-b border-[#1E3447]">
          <div className="relative bg-[#060B12] rounded-xl overflow-hidden aspect-video">
            {isCameraOn ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[#94A3B8]">
                <div className="text-center">
                  <VideoCameraIcon className="h-16 w-16 mx-auto mb-2 opacity-50" />
                  <p>Camera is off</p>
                  <button
                    onClick={startCamera}
                    className="mt-2 px-4 py-2 bg-[#00C8FF] text-[#060B12] rounded-lg text-sm font-medium hover:bg-[#00C8FF]/80 transition"
                  >
                    Start Camera
                  </button>
                </div>
              </div>
            )}
            
            {/* Controls Overlay */}
            {isCameraOn && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#060B12]/80 rounded-lg p-2">
                <button
                  onClick={toggleCamera}
                  className={`p-2 rounded-lg transition ${
                    isCameraOn ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-[#1E3447] text-[#94A3B8]'
                  }`}
                >
                  <VideoCameraIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={toggleMic}
                  className={`p-2 rounded-lg transition ${
                    isMicOn ? 'bg-[#00C8FF] text-[#060B12]' : 'bg-[#1E3447] text-[#94A3B8]'
                  }`}
                >
                  <MicrophoneIcon className="h-5 w-5" />
                </button>
                <button className="p-2 bg-[#1E3447] text-[#94A3B8] rounded-lg hover:bg-[#162534] transition">
                  <ComputerDesktopIcon className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1">
              Stream Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your stream about?"
              className="w-full px-4 py-2 bg-[#0D1722] border border-[#1E3447] rounded-lg text-[#F1F5F9] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00C8FF]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell viewers what your stream is about..."
              rows={2}
              className="w-full px-4 py-2 bg-[#0D1722] border border-[#1E3447] rounded-lg text-[#F1F5F9] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00C8FF]"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1">
              Who can watch?
            </label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  setVisibility('public');
                  setShowSectionSelector(false);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  visibility === 'public'
                    ? 'bg-[#00C8FF] text-[#060B12]'
                    : 'bg-[#0D1722] text-[#94A3B8] hover:bg-[#162534]'
                }`}
              >
                Public
              </button>
              <button
                onClick={() => {
                  setVisibility('friends');
                  setShowSectionSelector(false);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  visibility === 'friends'
                    ? 'bg-[#00C8FF] text-[#060B12]'
                    : 'bg-[#0D1722] text-[#94A3B8] hover:bg-[#162534]'
                }`}
              >
                Friends Only
              </button>
              {(isProfessor || isAdmin) && (
                <button
                  onClick={() => {
                    setVisibility('section');
                    setShowSectionSelector(true);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    visibility === 'section'
                      ? 'bg-[#00C8FF] text-[#060B12]'
                      : 'bg-[#0D1722] text-[#94A3B8] hover:bg-[#162534]'
                  }`}
                >
                  Specific Section
                </button>
              )}
            </div>
          </div>

          {/* Section Selector */}
          {showSectionSelector && (
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1">
                Select Sections *
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto bg-[#0D1722] rounded-lg p-2 border border-[#1E3447]">
                {professorSections.length === 0 ? (
                  <p className="text-sm text-[#94A3B8] p-2">No sections found</p>
                ) : (
                  professorSections.map((section) => (
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
                        {section.course && (
                          <span className="text-[#94A3B8] ml-1">({section.course})</span>
                        )}
                      </span>
                      <span className="text-xs text-[#94A3B8] ml-auto">
                        {section.member_count || 0} students
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1E3447]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[#94A3B8] hover:text-[#F1F5F9] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !title.trim()}
              className="px-6 py-2 bg-[#EF4444] text-white rounded-lg font-medium hover:bg-[#EF4444]/80 transition disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Go Live'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}