// frontend/src/features/dashboard/components/GlobalSearchDropdown.tsx
import {
  UserGroupIcon,
  DocumentTextIcon,
  MegaphoneIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';
import { GlobalSearchResults } from '../hooks/useGlobalSearch';
import { formatRelativeTime } from '@/lib/formatters';

interface GlobalSearchDropdownProps {
  results: GlobalSearchResults;
  onSelectPerson: (userId: string) => void;
  onSelectPost: (postId: string) => void;
  onSelectAnnouncement: (announcementId: string) => void;
  onSelectSection: (sectionId: string) => void;
}

function personName(p: { first_name?: string; last_name?: string; username: string }): string {
  return p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : p.username;
}

function SectionLabel({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <p className="flex items-center gap-1.5 px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </p>
  );
}

/** Dropdown panel rendered below the Topbar search input - grouped results
 * across people/posts/announcements/sections. Purely presentational; the
 * actual data comes from useGlobalSearch (people via the real /users/search
 * endpoint, everything else filtered client-side over data the dashboard
 * already loaded through its normal, visibility-scoped hooks). */
export function GlobalSearchDropdown({
  results,
  onSelectPerson,
  onSelectPost,
  onSelectAnnouncement,
  onSelectSection,
}: GlobalSearchDropdownProps) {
  const { people, posts, announcements, sections, isLoading, hasResults } = results;

  return (
    <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-[#1E3447] bg-[#0D1722] shadow-2xl max-h-[70vh] overflow-y-auto themed-scrollbar z-50">
      {isLoading && !hasResults ? (
        <p className="text-sm text-[#64748B] text-center py-6">Searching...</p>
      ) : !hasResults ? (
        <p className="text-sm text-[#64748B] text-center py-6">No results found.</p>
      ) : (
        <div className="py-1">
          {people.length > 0 && (
            <div>
              <SectionLabel icon={UserGroupIcon} label="People" />
              {people.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectPerson(p.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition text-left"
                >
                  <Avatar src={p.avatar_url} name={personName(p)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#F1F5F9] truncate">{personName(p)}</p>
                    <p className="text-xs text-[#64748B] truncate">@{p.username}</p>
                  </div>
                  <RoleBadge role={p.role} />
                </button>
              ))}
            </div>
          )}

          {announcements.length > 0 && (
            <div>
              <SectionLabel icon={MegaphoneIcon} label="Announcements" />
              {announcements.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onSelectAnnouncement(a.id)}
                  className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-white/5 transition text-left"
                >
                  <MegaphoneIcon className="h-4 w-4 text-[#00C8FF] mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#F1F5F9] truncate">{a.title}</p>
                    <p className="text-xs text-[#64748B] truncate">{formatRelativeTime(a.created_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {posts.length > 0 && (
            <div>
              <SectionLabel icon={DocumentTextIcon} label="Posts" />
              {posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => onSelectPost(post.id)}
                  className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-white/5 transition text-left"
                >
                  <Avatar src={post.avatar_url} name={post.username} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#F1F5F9] truncate">
                      <span className="font-medium">{post.username}</span>
                      <span className="text-[#64748B]"> • {formatRelativeTime(post.created_at)}</span>
                    </p>
                    <p className="text-xs text-[#94A3B8] truncate">{post.content}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {sections.length > 0 && (
            <div>
              <SectionLabel icon={UsersIcon} label="Sections" />
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelectSection(s.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition text-left"
                >
                  <div className="h-8 w-8 rounded-lg bg-[#00C8FF]/10 border border-[#00C8FF]/25 flex items-center justify-center flex-shrink-0">
                    <UsersIcon className="h-4 w-4 text-[#00C8FF]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#F1F5F9] truncate">{s.name}</p>
                    <p className="text-xs text-[#64748B] truncate">
                      {s.course}
                      {s.year_level ? ` • Year ${s.year_level}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
