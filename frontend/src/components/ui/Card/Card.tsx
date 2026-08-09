// frontend/src/components/ui/Card/Card.tsx
import { ReactNode } from 'react';
import { cn } from '../cn';

interface CardProps {
  children: ReactNode;
  variant?: 'solid' | 'glass' | 'glass-dark';
  className?: string;
  hover?: boolean;
}

export function Card({
  children,
  variant = 'solid',
  className = '',
  hover = true,
}: CardProps) {
  const variants = {
    solid: 'bg-white shadow-sm border border-gray-100',
    glass: 'glass',
    'glass-dark': 'glass-dark',
  };

  return (
    <div
      className={cn(
        variants[variant],
        'rounded-xl p-6',
        hover ? 'transition-all duration-200 hover:shadow-lg' : '',
        className
      )}
    >
      {children}
    </div>
  );
}
