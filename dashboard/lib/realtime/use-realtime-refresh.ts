'use client';

/**
 * Hook: usePollingRefresh
 *
 * Polls for data changes by calling router.refresh() at a fixed interval.
 * Respects the pause state from RefreshProvider.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useRefreshReport, useRefreshPaused } from '@/lib/realtime/realtime-provider';

/** Default polling interval in ms */
const DEFAULT_INTERVAL_MS = 5000;

export function usePollingRefresh(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  const router = useRouter();
  const reportStatus = useRefreshReport();
  const isPaused = useRefreshPaused();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isPaused) {
      reportStatus('polling', 'active'); // Still "active" page, just paused
      return;
    }

    reportStatus('polling', 'active');

    timerRef.current = setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      reportStatus('polling', 'inactive');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, isPaused]);
}
