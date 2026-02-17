'use client';

/**
 * RefreshIndicator
 *
 * Shows auto-refresh status with countdown timer and pause/resume toggle.
 * Replaces the simpler ConnectionStatus component.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRefreshConnection } from '@/lib/realtime/realtime-provider';
import { Pause, Play, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const INTERVAL_SECONDS = 5;

export function RefreshIndicator() {
  const { isActive, isPaused, setPaused } = useRefreshConnection();
  const [countdown, setCountdown] = useState(INTERVAL_SECONDS);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!isActive || isPaused) {
      setCountdown(INTERVAL_SECONDS);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    setCountdown(INTERVAL_SECONDS);
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Flash green on refresh
          setJustRefreshed(true);
          setTimeout(() => setJustRefreshed(false), 2000);
          return INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, isPaused]);

  const togglePause = useCallback(() => {
    setPaused(!isPaused);
  }, [isPaused, setPaused]);

  if (!isActive && !isPaused) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-zinc-500" />
        </span>
        <span>No active page</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          {isActive && !isPaused && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                justRefreshed ? 'bg-emerald-300' : 'bg-emerald-400'
              }`}
            />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full transition-colors ${
              isPaused
                ? 'bg-zinc-500'
                : justRefreshed
                  ? 'bg-emerald-300'
                  : 'bg-emerald-500'
            }`}
          />
        </span>
        <span className="text-muted-foreground">
          {isPaused ? (
            'Paused'
          ) : (
            <>
              <RefreshCw className={cn('inline h-3 w-3 mr-0.5', justRefreshed && 'animate-spin')} />
              {countdown}s
            </>
          )}
        </span>
      </div>
      <button
        onClick={togglePause}
        className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
        title={isPaused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
      >
        {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
      </button>
    </div>
  );
}
