'use client';

/**
 * RefreshProvider
 *
 * Provides auto-refresh (polling) state to child components via React Context.
 * Supports pause/resume for the RefreshIndicator toggle.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

export type RefreshState = 'active' | 'inactive';

interface RefreshContextValue {
  /** Whether any page is actively polling */
  isActive: boolean;
  /** Whether polling is paused by user */
  isPaused: boolean;
  /** Toggle pause state */
  setPaused: (paused: boolean) => void;
  /** Called by usePollingRefresh to report status */
  reportStatus: (id: string, status: RefreshState) => void;
}

const RefreshContext = createContext<RefreshContextValue>({
  isActive: false,
  isPaused: false,
  setPaused: () => {},
  reportStatus: () => {},
});

export function useRefreshConnection(): {
  isActive: boolean;
  isPaused: boolean;
  setPaused: (paused: boolean) => void;
} {
  const { isActive, isPaused, setPaused } = useContext(RefreshContext);
  return { isActive, isPaused, setPaused };
}

export function useRefreshReport(): (id: string, status: RefreshState) => void {
  const { reportStatus } = useContext(RefreshContext);
  return reportStatus;
}

export function useRefreshPaused(): boolean {
  const { isPaused } = useContext(RefreshContext);
  return isPaused;
}

interface RefreshProviderProps {
  children: ReactNode;
}

export function RefreshProvider({ children }: RefreshProviderProps) {
  const [pollerStates, setPollerStates] = useState<Record<string, RefreshState>>({});
  const [isPaused, setIsPaused] = useState(false);

  const reportStatus = useCallback((id: string, status: RefreshState) => {
    setPollerStates((prev) => {
      if (prev[id] === status) return prev;
      return { ...prev, [id]: status };
    });
  }, []);

  const setPaused = useCallback((paused: boolean) => {
    setIsPaused(paused);
  }, []);

  const isActive = useMemo(() => {
    return Object.values(pollerStates).some((s) => s === 'active');
  }, [pollerStates]);

  const value = useMemo(
    () => ({ isActive, isPaused, setPaused, reportStatus }),
    [isActive, isPaused, setPaused, reportStatus]
  );

  return (
    <RefreshContext.Provider value={value}>
      {children}
    </RefreshContext.Provider>
  );
}

// Backward-compat export
export { RefreshProvider as RealtimeProvider };
