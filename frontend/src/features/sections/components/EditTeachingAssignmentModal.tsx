// frontend/src/features/sections/components/EditTeachingAssignmentModal.tsx
import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTeachingAssignments } from '../hooks/useTeachingAssignments';
import { TeachingAssignment } from '@/types/section.types';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface EditTeachingAssignmentModalProps {
  assignment: TeachingAssignment;
  onClose: () => void;
}

const inputClassName =
  'w-full px-3 py-2 rounded-xl border border-[#1E3447] bg-[#162534] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none transition';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function EditTeachingAssignmentModal({ assignment, onClose }: EditTeachingAssignmentModalProps) {
  const { updateAssignment, removeAssignment } = useTeachingAssignments();
  const [subject, setSubject] = useState(assignment.subject);
  const [days, setDays] = useState<string[]>(assignment.schedule_days || []);
  const [startTime, setStartTime] = useState(assignment.schedule_start?.slice(0, 5) || '');
  const [endTime, setEndTime] = useState(assignment.schedule_end?.slice(0, 5) || '');
  const [status, setStatus] = useState(assignment.status);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const toggleDay = (day: string) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await updateAssignment({
        id: assignment.id,
        data: { subject, schedule_days: days, schedule_start: startTime, schedule_end: endTime, status },
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update teaching assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      await removeAssignment(assignment.id);
      onClose();
    } catch {
      setLoading(false);
      setShowRemoveConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="w-full max-w-md rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)] p-6 max-h-[90vh] overflow-y-auto themed-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#F1F5F9]">Edit Teaching Assignment</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-full transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 text-sm text-[#F1F5F9]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className={inputClassName}
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
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClassName} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">End Time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClassName} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')} className={inputClassName}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#1E3447]">
            <button
              type="button"
              onClick={() => setShowRemoveConfirm(true)}
              className="px-4 py-2 text-sm font-medium text-[#EF4444] hover:bg-[#EF4444]/10 rounded-xl transition"
            >
              Remove
            </button>
            <div className="flex items-center gap-3">
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
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showRemoveConfirm && (
        <ConfirmDialog
          title="Remove Teaching Assignment"
          message={
            <>
              Stop teaching <span className="font-semibold text-[#F1F5F9]">{assignment.subject}</span>{' '}
              in this section? The section, its students, mayor, officer, and other professors are not affected.
            </>
          }
          confirmLabel="Remove"
          isLoading={loading}
          onConfirm={handleRemove}
          onCancel={() => setShowRemoveConfirm(false)}
        />
      )}
    </div>
  );
}
