// frontend/src/features/dashboard/components/Avatar.tsx
interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses: Record<string, string> = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-sm',
  md: 'w-11 h-11 text-base',
  lg: 'w-14 h-14 text-lg',
};

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const initial = name?.charAt(0).toUpperCase() || 'U';

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-[#00C8FF] to-[#3B82F6] flex items-center justify-center font-bold text-[#060B12] overflow-hidden flex-shrink-0 ${className}`}
    >
      {src ? (
        <img src={src} alt={name || 'User'} className="w-full h-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}
