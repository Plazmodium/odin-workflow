'use client';

/**
 * PollingSubscription
 *
 * A zero-UI Client Component that activates auto-refresh polling.
 * When mounted, it starts polling via router.refresh() at a fixed interval
 * to re-fetch Server Component data.
 *
 * Renders nothing — just activates the polling as a side effect.
 * Place it anywhere inside a Server Component page as a sibling.
 *
 * Usage:
 *   <PollingSubscription />
 *   <div>...server-rendered content...</div>
 */

import { usePollingRefresh } from '@/lib/realtime/use-realtime-refresh';

interface PollingSubscriptionProps {
  /** Polling interval in ms (default: 5000) */
  intervalMs?: number;
}

export function PollingSubscription({ intervalMs }: PollingSubscriptionProps) {
  usePollingRefresh(intervalMs);
  return null;
}

// Backward-compat export names
export { PollingSubscription as RealtimeSubscription };
export { PollingSubscription as RealtimePage };
