// frontend/src/features/dashboard/components/SectionWidget.tsx
import { UsersIcon } from '@heroicons/react/24/outline';
import { Section } from '@/types/section.types';
import { Avatar } from './Avatar';

interface SectionWidgetProps {
  section: Section | null;
  isLoading: boolean;
  onGoToSection: () => void;
}

export function SectionWidget({ section, isLoading, onGoToSection }: SectionWidgetProps) {
  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]/60 backdrop-blur-xl p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
        <UsersIcon className="h-4 w-4 text-[#00d4ff]" />
        Your Section
      </h3>

      {isLoading ? (
        <p className="text-xs text-[#6b6b6b] py-4 text-center">Loading...</p>
      ) : !section ? (
        <p className="text-xs text-[#6b6b6b] py-4 text-center">
          You're not enrolled in a section yet.
        </p>
      ) : (
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{section.name}</p>
              {section.course && <p className="text-xs text-[#6b6b6b]">{section.course}</p>}
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
              Active
            </span>
          </div>

          {section.advisor_id && (
            <p className="text-xs text-[#a0a0a0] mt-2">Advisor assigned</p>
          )}

          {section.members && section.members.length > 0 && (
            <div className="flex items-center mt-3 -space-x-2">
              {section.members.slice(0, 5).map((m) => (
                <Avatar
                  key={m.id}
                  src={m.user_avatar}
                  name={m.user_username || undefined}
                  size="xs"
                  className="ring-2 ring-[#1a1a1a]"
                />
              ))}
              {section.member_count > 5 && (
                <div className="w-7 h-7 rounded-full bg-[#2a2a2a] ring-2 ring-[#1a1a1a] flex items-center justify-center text-[10px] font-medium text-[#a0a0a0]">
                  +{section.member_count - 5}
                </div>
              )}
            </div>
          )}

          <button
            onClick={onGoToSection}
            className="w-full mt-3 text-sm font-medium text-center py-2 rounded-xl bg-[#00d4ff]/10 text-[#00d4ff] hover:bg-[#00d4ff]/20 transition"
          >
            Go to Section
          </button>
        </div>
      )}
    </div>
  );
}
