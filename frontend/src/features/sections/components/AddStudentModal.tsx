// frontend/src/features/sections/components/AddStudentModal.tsx
import { useEffect, useRef, useState } from 'react';
import { useSections } from '../hooks/useSections';
import { useUsers } from '../../users/hooks/useUsers';
import { Avatar } from '@/features/dashboard/components/Avatar';
import { User } from '@/features/auth/types/auth.types';
import { XMarkIcon, MagnifyingGlassIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface AddStudentModalProps {
  sectionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const inputClassName =
  'w-full pl-9 pr-8 py-2.5 rounded-xl border border-[#1E3447] bg-[#162534] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:ring-1 focus:ring-[#00C8FF] focus:border-[#00C8FF] focus:outline-none transition';

function studentFullName(student: User): string {
  if (student.first_name) return `${student.first_name} ${student.last_name || ''}`.trim();
  return student.username;
}

export default function AddStudentModal({ sectionId, onClose, onSuccess }: AddStudentModalProps) {
  const { addMember } = useSections();
  const { users, isLoading: searching, searchUsers } = useUsers();
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced, automatic search as the professor/mayor/officer types - no
  // separate "select student" dropdown to submit first.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim().length >= 2) {
        searchUsers(search.trim(), 'student');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!showResults) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showResults]);

  const handleSelect = (student: User) => {
    setSelectedStudent(student);
    setSearch('');
    setShowResults(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      setError('Please search for and select a student first');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await addMember({ sectionId, userId: selectedStudent.id });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add student');
    } finally {
      setLoading(false);
    }
  };

  const studentResults = users?.filter((u) => u.role === 'student') || [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="w-full max-w-md rounded-2xl border border-[#1E3447] bg-[#111E2B] shadow-[0_0_40px_rgba(0,200,255,0.06)] p-4 sm:p-6 max-h-[90vh] overflow-y-auto themed-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#F1F5F9]">Add Student</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-full transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444] text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Student</label>

            {selectedStudent ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-[#00C8FF]/40 bg-[#00C8FF]/5">
                <Avatar src={selectedStudent.avatar_url} name={studentFullName(selectedStudent)} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#F1F5F9] truncate">{studentFullName(selectedStudent)}</p>
                  <p className="text-xs text-[#64748B] truncate">{selectedStudent.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  title="Change student"
                  className="p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-lg transition flex-shrink-0"
                >
                  <XCircleIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative" ref={wrapperRef}>
                <MagnifyingGlassIcon className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  placeholder="Type a name, username, or email..."
                  className={inputClassName}
                  autoComplete="off"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setShowResults(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#F1F5F9] transition"
                  >
                    <XCircleIcon className="h-4 w-4" />
                  </button>
                )}

                {showResults && search.trim().length >= 2 && (
                  <div className="absolute z-10 mt-1.5 w-full max-h-64 overflow-y-auto themed-scrollbar rounded-xl border border-[#1E3447] bg-[#111E2B] shadow-xl">
                    {searching ? (
                      <div className="p-3 space-y-2">
                        {[0, 1].map((i) => (
                          <div key={i} className="h-10 rounded-lg bg-[#162534] animate-pulse" />
                        ))}
                      </div>
                    ) : studentResults.length === 0 ? (
                      <p className="text-sm text-[#64748B] text-center py-4">No students found.</p>
                    ) : (
                      studentResults.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => handleSelect(student)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition"
                        >
                          <Avatar src={student.avatar_url} name={studentFullName(student)} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#F1F5F9] truncate">{studentFullName(student)}</p>
                            <p className="text-xs text-[#64748B] truncate">{student.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-[#1E3447]">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedStudent}
              className="w-full sm:w-auto px-6 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
