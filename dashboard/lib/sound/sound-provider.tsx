'use client';

/**
 * SoundNotificationProvider
 *
 * Provides sound notification capabilities for workflow events.
 * Handles mute state (localStorage), browser autoplay restrictions,
 * and exposes a playSound method for child components.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';

type SoundType = 'feature-created' | 'feature-completed';

const SOUND_URLS: Record<SoundType, string> = {
  'feature-created': '/sounds/feature-created.wav',
  'feature-completed': '/sounds/feature-completed.wav',
};

const MUTE_STORAGE_KEY = 'odin-sound-muted';

interface SoundContextValue {
  /** Whether sounds are muted */
  isMuted: boolean;
  /** Toggle mute state (persisted to localStorage) */
  toggleMute: () => void;
  /** Play a notification sound (respects mute, handles autoplay) */
  playSound: (type: SoundType) => void;
  /** Whether browser has allowed audio playback */
  isAudioUnlocked: boolean;
}

const SoundContext = createContext<SoundContextValue>({
  isMuted: false,
  toggleMute: () => { },
  playSound: () => { },
  isAudioUnlocked: false,
});

export function useSoundNotification(): SoundContextValue {
  return useContext(SoundContext);
}

interface SoundProviderProps {
  children: ReactNode;
}

export function SoundNotificationProvider({ children }: SoundProviderProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const audioCache = useRef<Map<SoundType, HTMLAudioElement>>(new Map());

  // Load mute preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MUTE_STORAGE_KEY);
      if (stored === 'true') {
        setIsMuted(true);
      }
    } catch {
      // localStorage not available (SSR, private browsing)
    }
  }, []);

  // Pre-load audio elements
  useEffect(() => {
    const cache = audioCache.current;
    for (const [type, url] of Object.entries(SOUND_URLS) as [SoundType, string][]) {
      if (!cache.has(type)) {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.volume = 0.5;
        cache.set(type, audio);
      }
    }
  }, []);

  // Listen for user interaction to unlock audio (browser autoplay policy)
  useEffect(() => {
    if (isAudioUnlocked) return;

    const unlock = () => {
      setIsAudioUnlocked(true);
    };

    // These events indicate user interaction, which unlocks audio
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [isAudioUnlocked]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_STORAGE_KEY, String(next));
      } catch {
        // localStorage not available
      }
      return next;
    });
  }, []);

  const playSound = useCallback(
    (type: SoundType) => {
      if (isMuted) return;

      const audio = audioCache.current.get(type);
      if (!audio) return;

      // Reset to start if already playing
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Browser blocked autoplay — silently ignore
        // Audio will work after user interacts with the page
      });
    },
    [isMuted]
  );

  const value = useMemo(
    () => ({ isMuted, toggleMute, playSound, isAudioUnlocked }),
    [isMuted, toggleMute, playSound, isAudioUnlocked]
  );

  return (
    <SoundContext.Provider value={value}>
      {children}
    </SoundContext.Provider>
  );
}
