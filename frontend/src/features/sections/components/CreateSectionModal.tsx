// frontend/src/features/sections/components/CreateSectionModal.tsx
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSections } from '../hooks/useSections';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { SectionBrowseItem } from '@/types/section.types';
import JoinSectionModal from './JoinSectionModal';

interface CreateSectionModalProps {
  onClose: () => void;
}

const inputClassName =
  'w-full px-3 py-2 rounded-xl border border-[#1E3447] bg-[#162534] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none transition';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CreateSectionModal({ onClose }: CreateSectionModalProps) {
  const { user } = useAuthStore();
  const isProfessor = user?.role === 'professor';
  const { createSection, browseSections } = useSections();
  const [formData, setFormData] = useState({
    name: '',
    course: '',
    year_level: 1,
    academic_year: '',
    description: '',
  });
  const [subject, setSubject] = useState('');
  const [days, setDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<SectionBrowseItem | null>(null);
  const [showJoinInstead, setShowJoinInstead] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleDay = (day: string) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  // Debounced duplicate-name check (case-insensitive, same academic_year) -
  // a hint only, never a blocking error, so the shared toast/detail-string
  // error handling convention is never involved.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const name = formData.name.trim();
    if (!name) {
      setDuplicateMatch(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const matches = await browseSections({ name });
        const exact = matches.find(
          (s) =>
            s.name.toLowerCase() === name.toLowerCase() &&
            (!formData.academic_year || s.academic_year === formData.academic_year)
        );
        setDuplicateMatch(exact || null);
      } catch {
        setDuplicateMatch(null);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [formData.name, formData.academic_year]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        ...(isProfessor && subject.trim() && days.length > 0 && startTime && endTime
          ? { subject, schedule_days: days, schedule_start: startTime, schedule_end: endTime }
          : {}),
      };
      await createSection(payload);
      onClose();
    } catch (error) {
      console.error('Failed to create section:', error);
    } finally {
      setLoading(false);
    }
  };

  if (showJoinInstead && duplicateMatch) {
    return <JoinSectionModal onClose={onClose} initialSection={duplicateMatch} />;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="w-full max-w-md rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)] p-6 max-h-[90vh] overflow-y-auto themed-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#F1F5F9]">Create Section</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-full transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">
              Section Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className={inputClassName}
              placeholder="e.g. BSIT-1A"
            />
            {duplicateMatch && (
              <div className="mt-2 flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[#F5B82E]/30 bg-[#F5B82E]/10">
                <p className="text-xs text-[#F1F5F9]">
                  Section "{duplicateMatch.name}" already exists{duplicateMatch.academic_year ? ` in ${duplicateMatch.academic_year}` : ''}.
                </p>
                <button
                  type="button"
                  onClick={() => setShowJoinInstead(true)}
                  className="text-xs font-semibold text-[#00C8FF] hover:underline flex-shrink-0"
                >
                  Join instead
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">
              Course
            </label>
            <input
              type="text"
              value={formData.course}
              onChange={(e) => setFormData({ ...formData, course: e.target.value })}
              className={inputClassName}
              placeholder="e.g. BSIT"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">
                Year Level
              </label>
              <select
                value={formData.year_level}
                onChange={(e) => setFormData({ ...formData, year_level: parseInt(e.target.value) })}
                className={inputClassName}
              >
                {[1, 2, 3, 4, 5, 6].map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">
                Academic Year
              </label>
              <input
                type="text"
                value={formData.academic_year}
                onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                className={inputClassName}
                placeholder="e.g. 2024-2025"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className={`${inputClassName} resize-none`}
              placeholder="Optional description"
            />
          </div>

          {isProfessor && (
            <div className="pt-2 border-t border-[#1E3447] space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Your Teaching Assignment (optional)
              </p>
              <div>
                <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={inputClassName}
                  placeholder="e.g. Web Systems"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Days</label>
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
                  <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1E3447]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Section'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
