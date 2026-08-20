// frontend/src/features/sections/components/TeachingAssignmentOnboardingBanner.tsx
import { useState } from 'react';
import { AcademicCapIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useTeachingAssignments } from '../hooks/useTeachingAssignments';
import CreateSectionModal from './CreateSectionModal';
import JoinSectionModal from './JoinSectionModal';

function dismissedKey(userId: string) {
  return `ccs_hub_teaching_setup_skipped_${userId}`;
}

export function TeachingAssignmentOnboardingBanner() {
  const { user } = useAuthStore();
  const { mine, isLoading } = useTeachingAssignments();
  const [dismissed, setDismissed] = useState(() =>
    user?.id ? localStorage.getItem(dismissedKey(user.id)) === '1' : false
  );
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  if (user?.role !== 'professor' || isLoading || mine.length > 0 || dismissed) return null;

  const skip = () => {
    if (user?.id) localStorage.setItem(dismissedKey(user.id), '1');
    setDismissed(true);
  };

  return (
    <>
      <div className="rounded-2xl border border-[#00C8FF]/25 bg-[#0D1722] shadow-[0_0_30px_rgba(0,200,255,0.06)] p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#00C8FF]/10 border border-[#00C8FF]/25 flex items-center justify-center flex-shrink-0">
            <AcademicCapIcon className="h-5 w-5 text-[#00C8FF]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[#F1F5F9]">Set Up Your Teaching Assignment</h3>
            <p className="text-sm text-[#94A3B8] mt-1">
              You're not teaching any sections yet. Create a new section or join an existing one to get started.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 text-sm font-semibold bg-gradient-to-br from-[#00C8FF] to-[#0090CC] text-[#060B12] rounded-xl hover:opacity-90 transition"
              >
                Create New Section
              </button>
              <button
                onClick={() => setShowJoin(true)}
                className="px-4 py-2 text-sm font-semibold border border-[#00C8FF]/30 bg-[#00C8FF]/10 text-[#00C8FF] rounded-xl hover:bg-[#00C8FF]/20 transition"
              >
                Join Existing Section
              </button>
              <button
                onClick={skip}
                className="px-4 py-2 text-sm font-medium text-[#64748B] hover:text-[#94A3B8] transition"
              >
                Skip for Now
              </button>
            </div>
          </div>
          <button
            onClick={skip}
            className="flex-shrink-0 p-1.5 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/5 rounded-full transition"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showCreate && <CreateSectionModal onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinSectionModal onClose={() => setShowJoin(false)} />}
    </>
  );
}
