// frontend/src/components/ui/ThemeToggle/ThemeToggle.tsx
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-label="Toggle theme"
      className="p-2 text-text-secondary hover:text-text-primary transition-all duration-200 rounded-xl hover:scale-110 active:scale-95"
    >
      {theme === 'light' ? (
        <MoonIcon className="h-5 w-5" />
      ) : (
        <SunIcon className="h-5 w-5" />
      )}
    </button>
  );
}