// frontend/src/features/sections/components/JoinSectionModal.tsx
import { useEffect, useState } from 'react';
import { XMarkIcon, UserGroupIcon, AcademicCapIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useSections } from '../hooks/useSections';
import { useTeachingAssignments } from '../hooks/useTeachingAssignments';
import { SectionBrowseItem } from '@/types/section.types';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface JoinSectionModalProps {
  onClose: () => void;
  /** Pre-select a section (e.g. when opened from "Section already exists - Join instead"). */
  initialSection?: SectionBrowseItem;
}

const inputClassName =
  'w-full px-3 py-2 rounded-xl border border-[#1E3447] bg-[#162534] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none transition';

const YEAR_LEVELS = [1, 2, 3, 4];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function JoinSectionModal({ onClose, initialSection }: JoinSectionModalProps) {
  const { browseSections } = useSections();
  const { joinSection } = useTeachingAssignments();

  const [step, setStep] = useState<'year' | 'section' | 'details'>(initialSection ? 'details' : 'year');
  const [yearLevel, setYearLevel] = useState<number | null>(null);
  const [results, setResults] = useState<SectionBrowseItem[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedSection, setSelectedSection] = useState<SectionBrowseItem | null>(initialSection || null);

  const [subject, setSubject] = useState('');
  const [days, setDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (yearLevel === null) return;
    setLoadingResults(true);
    browseSections({ year_level: yearLevel })
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoadingResults(false));
  }, [yearLevel]);

  const toggleDay = (day: string) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSubmit = async () => {
    if (!selectedSection) return;
    setLoading(true);
    setError(null);
    try {
      await joinSection({
        sectionId: selectedSection.id,
        data: { subject, schedule_days: days, schedule_start: startTime, schedule_end: endTime },
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to join section');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  const canSubmitDetails = subject.trim() && days.length > 0 && startTime && endTime;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="w-full max-w-md rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)] p-6 max-h-[90vh] overflow-y-auto themed-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#F1F5F9]">Join Existing Section</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-full transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {step === 'year' && (
          <div className="space-y-3">
            <p className="text-sm text-[#94A3B8]">Which year level are you teaching?</p>
            <div className="grid grid-cols-2 gap-3">
              {YEAR_LEVELS.map((y) => (
                <button
                  key={y}
                  onClick={() => {
                    setYearLevel(y);
                    setStep('section');
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#1E3447] bg-[#162534] text-sm font-semibold text-[#F1F5F9] hover:border-[#00C8FF]/40 hover:text-[#00C8FF] transition"
                >
                  <AcademicCapIcon className="h-4 w-4" />
                  Year {y}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'section' && (
          <div className="space-y-3">
            <button
              onClick={() => setStep('year')}
              className="text-xs font-medium text-[#00C8FF] hover:underline"
            >
              &larr; Change year
            </button>
            {loadingResults ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-[#162534]/60 animate-pulse" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <p className="text-sm text-[#64748B] text-center py-8">No sections found for Year {yearLevel}.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto themed-scrollbar">
                {results.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSection(s);
                      setStep('details');
                    }}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-[#1E3447] bg-[#162534]/60 hover:border-[#00C8FF]/40 transition text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#F1F5F9] truncate">{s.name}</p>
                      <p className="text-xs text-[#64748B] truncate">
                        {s.course} • {s.member_count} student{s.member_count === 1 ? '' : 's'} •{' '}
                        {s.professor_count} professor{s.professor_count === 1 ? '' : 's'}
                      </p>
                    </div>
                    {/* already_teaching no longer disables selection - a professor can
                        teach multiple subjects in the same section, so re-selecting it
                        just adds another subject rather than being blocked. */}
                    {s.already_teaching ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/30 rounded-full px-2 py-0.5 flex-shrink-0">
                        <CheckCircleIcon className="h-3 w-3" />
                        Add subject
                      </span>
                    ) : (
                      <UserGroupIcon className="h-4 w-4 text-[#64748B] flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'details' && selectedSection && (
          <div className="space-y-4">
            {!initialSection && (
              <button
                onClick={() => setStep('section')}
                className="text-xs font-medium text-[#00C8FF] hover:underline"
              >
                &larr; Change section
              </button>
            )}
            <div className="rounded-xl border border-[#00C8FF]/25 bg-[#00C8FF]/5 p-3">
              <p className="text-sm font-semibold text-[#F1F5F9]">{selectedSection.name}</p>
              <p className="text-xs text-[#64748B]">{selectedSection.course}</p>
              {selectedSection.already_teaching && (
                <p className="text-xs text-[#00C8FF] mt-1">
                  You already teach in this section - this adds another subject.
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 text-sm text-[#F1F5F9]">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={inputClassName}
                placeholder="e.g. Web Systems"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Days *</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      days.includes(day)
                        ? 'bg-[#00C8FF]/15 border-[#00C8FF]/40 text-[#00C8FF]'
                        : 'bg-[#162534] border-[#1E3447] text-[#94A3B8] hover:border-[#00C8FF]/30'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Start Time *</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">End Time *</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1E3447]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmitDetails}
                onClick={() => setShowConfirm(true)}
                className="px-6 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>

      {showConfirm && selectedSection && (
        <ConfirmDialog
          title={selectedSection.already_teaching ? 'Add Subject?' : 'Join Section?'}
          message={
            selectedSection.already_teaching ? (
              <>
                Add <span className="font-semibold text-[#F1F5F9]">{subject}</span> to your subjects in{' '}
                <span className="font-semibold text-[#F1F5F9]">{selectedSection.name}</span>.
              </>
            ) : (
              <>
                You are about to join{' '}
                <span className="font-semibold text-[#F1F5F9]">{selectedSection.name}</span> to teach{' '}
                <span className="font-semibold text-[#F1F5F9]">{subject}</span>.
              </>
            )
          }
          confirmLabel={selectedSection.already_teaching ? 'Yes, Add Subject' : 'Yes, Join Section'}
          danger={false}
          isLoading={loading}
          onConfirm={handleSubmit}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
