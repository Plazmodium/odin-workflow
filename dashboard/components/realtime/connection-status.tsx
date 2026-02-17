'use client';

/**
 * ConnectionStatus
 *
 * Displays a small indicator showing the auto-refresh polling state.
 * - Green pulsing dot + "Auto-refresh" when polling is active
 * - Grey dot + "Paused" when no page is polling
 */

import { useRefreshConnection } from '@/lib/realtime/realtime-provider';

export function ConnectionStatus() {
  const { isActive } = useRefreshConnection();

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2">
        {isActive && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-emerald-400"
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            isActive ? 'bg-emerald-500' : 'bg-zinc-500'
          }`}
        />
      </span>
      <span>{isActive ? 'Auto-refresh' : 'Paused'}</span>
    </div>
  );
}
