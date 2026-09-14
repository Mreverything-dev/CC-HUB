// frontend/src/components/ui/LoadingScreen/LoadingScreen.tsx
import { LogoIcon } from '@/components/ui/Logo/Logo';

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg">
      {/* Breathing logo — smooth scale in/out */}
      <div className="animate-breathe">
        <LogoIcon size="lg" background="dark" />
      </div>
    </div>
  );
}