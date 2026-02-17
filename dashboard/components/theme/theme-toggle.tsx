'use client';

/**
 * ThemeToggle
 *
 * Light/dark mode toggle button for the sidebar footer.
 * Follows the same pattern as SoundToggle.
 */

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme/theme-provider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5">
        {isDark ? (
          <Moon className="h-3 w-3 text-blue-400" />
        ) : (
          <Sun className="h-3 w-3 text-amber-500" />
        )}
        <span className="text-muted-foreground">
          {isDark ? 'Dark mode' : 'Light mode'}
        </span>
      </div>
      <button
        onClick={toggleTheme}
        className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? (
          <Sun className="h-3 w-3" />
        ) : (
          <Moon className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
