// frontend/src/features/dashboard/components/RoleBadge.tsx
const roleStyles: Record<string, string> = {
  admin: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  professor: 'bg-[#00d4ff]/15 text-[#00d4ff] border-[#00d4ff]/30',
  student: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
};

export function RoleBadge({ role, className = '' }: { role: string; className?: string }) {
  const style = roleStyles[role] || roleStyles.student;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${style} ${className}`}
    >
      {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Student'}
    </span>
  );
}
