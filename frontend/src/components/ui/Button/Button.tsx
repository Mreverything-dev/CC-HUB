// frontend/src/components/ui/Button/Button.tsx
import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/20',
    secondary: 'bg-gray-800 hover:bg-gray-700 text-white',
    outline: 'border-2 border-gray-300 hover:border-cyan-500 text-gray-700 hover:text-cyan-500',
    ghost: 'hover:bg-gray-100 text-gray-600 hover:text-gray-900',
    glass: 'glass text-gray-800 hover:bg-white/25',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={cn(
        variants[variant],
        sizes[size],
        fullWidth ? 'w-full' : '',
        'rounded-lg font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-cyan-500/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
