// frontend/src/components/ui/LoadingScreen/LoadingScreen.tsx
import { LogoIcon } from '@/components/ui/Logo/Logo';

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="animate-pulse">
          <LogoIcon size="lg" background="dark" />
        </div>

        {/* App name - theme-aware text color */}
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-bold text-text-primary">CCS HUB</h1>
          <p className="text-sm text-text-secondary">{message}</p>
        </div>

        {/* Dots */}
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#00C8FF] animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="h-2 w-2 rounded-full bg-[#00C8FF] animate-pulse" style={{ animationDelay: '200ms' }} />
          <div className="h-2 w-2 rounded-full bg-[#00C8FF] animate-pulse" style={{ animationDelay: '400ms' }} />
        </div>
      </div>
    </div>
  );
}