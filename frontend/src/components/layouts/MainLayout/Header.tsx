// frontend/src/components/layouts/MainLayout/Header.tsx
import { Button } from '@/components/ui/Button/Button';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-white/40 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-lg font-bold text-white shadow-lg shadow-cyan-500/20">
            C
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">CCS HUB</p>
            <p className="text-xs text-gray-500">Community dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm">
            Notifications
          </Button>
          <Button variant="primary" size="sm">
            Profile
          </Button>
        </div>
      </div>
    </header>
  );
}
