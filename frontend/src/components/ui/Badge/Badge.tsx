// frontend/src/components/ui/Badge/Badge.tsx
import { ReactNode } from 'react';
import { cn } from '../cn';

interface BadgeProps {
  children: ReactNode;
  variant?: 'solid' | 'outline' | 'glass' | 'subtle';
  color?: 'gray' | 'cyan' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'pink';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  icon?: ReactNode;
  dot?: boolean;
  rounded?: boolean;
}

export function Badge({
  children,
  variant = 'solid',
  color = 'gray',
  size = 'md',
  className = '',
  icon,
  dot = false,
  rounded = false,
}: BadgeProps) {
  const colors = {
    gray: {
      solid: 'bg-gray-100 text-gray-700',
      outline: 'border-gray-300 text-gray-600',
      glass: 'glass text-gray-700',
      subtle: 'bg-gray-50 text-gray-500',
    },
    cyan: {
      solid: 'bg-cyan-500 text-white',
      outline: 'border-cyan-400 text-cyan-600',
      glass: 'glass text-cyan-700',
      subtle: 'bg-cyan-50 text-cyan-600',
    },
    blue: {
      solid: 'bg-blue-500 text-white',
      outline: 'border-blue-400 text-blue-600',
      glass: 'glass text-blue-700',
      subtle: 'bg-blue-50 text-blue-600',
    },
    green: {
      solid: 'bg-green-500 text-white',
      outline: 'border-green-400 text-green-600',
      glass: 'glass text-green-700',
      subtle: 'bg-green-50 text-green-600',
    },
    yellow: {
      solid: 'bg-yellow-500 text-white',
      outline: 'border-yellow-400 text-yellow-600',
      glass: 'glass text-yellow-700',
      subtle: 'bg-yellow-50 text-yellow-600',
    },
    red: {
      solid: 'bg-red-500 text-white',
      outline: 'border-red-400 text-red-600',
      glass: 'glass text-red-700',
      subtle: 'bg-red-50 text-red-600',
    },
    purple: {
      solid: 'bg-purple-500 text-white',
      outline: 'border-purple-400 text-purple-600',
      glass: 'glass text-purple-700',
      subtle: 'bg-purple-50 text-purple-600',
    },
    pink: {
      solid: 'bg-pink-500 text-white',
      outline: 'border-pink-400 text-pink-600',
      glass: 'glass text-pink-700',
      subtle: 'bg-pink-50 text-pink-600',
    },
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const dotColors = {
    gray: 'bg-gray-400',
    cyan: 'bg-cyan-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    pink: 'bg-pink-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        variant === 'outline' ? 'border-2' : '',
        variant === 'glass' ? 'glass' : '',
        variant === 'subtle' ? 'border border-transparent' : '',
        colors[color][variant],
        sizes[size],
        rounded ? 'rounded-full' : 'rounded-lg',
        'transition-all duration-200',
        className
      )}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full animate-pulse', dotColors[color])}
        />
      )}

      {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}

      {children}
    </span>
  );
}
