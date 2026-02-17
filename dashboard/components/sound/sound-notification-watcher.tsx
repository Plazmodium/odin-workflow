'use client';

/**
 * SoundNotificationWatcher
 *
 * Zero-UI client component that detects workflow events from feature data
 * and plays appropriate notification sounds.
 *
 * Events detected:
 * - New feature created → plays "feature-created" sound
 * - Feature completed → plays "feature-completed" sound
 *
 * Uses sessionStorage to track "seen" features so sounds don't replay
 * on page refresh within the same tab session.
 */

import { useEffect, useRef } from 'react';
import { useSoundNotification } from '@/lib/sound/sound-provider';

const SEEN_FEATURES_KEY = 'odin-seen-feature-ids';
const SEEN_COMPLETED_KEY = 'odin-seen-completed-ids';
const INITIALIZED_KEY = 'odin-sound-initialized';

interface FeatureSnapshot {
  id: string;
  status: string;
}

interface SoundNotificationWatcherProps {
  /** Current features from server data (id + status) */
  features: FeatureSnapshot[];
}

function getSessionSet(key: string): Set<string> {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) {
      return new Set(JSON.parse(stored) as string[]);
    }
  } catch {
    // sessionStorage not available
  }
  return new Set();
}

function setSessionSet(key: string, set: Set<string>): void {
  try {
    sessionStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // sessionStorage not available
  }
}

function isSessionInitialized(): boolean {
  try {
    return sessionStorage.getItem(INITIALIZED_KEY) === 'true';
  } catch {
    return false;
  }
}

function markSessionInitialized(): void {
  try {
    sessionStorage.setItem(INITIALIZED_KEY, 'true');
  } catch {
    // sessionStorage not available
  }
}

export function SoundNotificationWatcher({ features }: SoundNotificationWatcherProps) {
  const { playSound } = useSoundNotification();
  const hasRunOnce = useRef(false);

  useEffect(() => {
    if (features.length === 0) return;

    const currentIds = new Set(features.map((f) => f.id));
    const currentCompleted = new Set(
      features.filter((f) => f.status === 'COMPLETED').map((f) => f.id)
    );

    // First render of this session (fresh tab): seed state, no sounds.
    // Uses sessionStorage so remounts (navigation) don't re-seed.
    if (!isSessionInitialized()) {
      setSessionSet(SEEN_FEATURES_KEY, currentIds);
      setSessionSet(SEEN_COMPLETED_KEY, currentCompleted);
      markSessionInitialized();
      hasRunOnce.current = true;
      return;
    }

    // Skip the very first effect after mount to avoid comparing stale
    // ref state with the initial server data (which is the same render
    // that hydrates the component). Subsequent polling renders will diff.
    if (!hasRunOnce.current) {
      hasRunOnce.current = true;
      return;
    }

    const seenIds = getSessionSet(SEEN_FEATURES_KEY);
    const seenCompleted = getSessionSet(SEEN_COMPLETED_KEY);

    // Detect new features (IDs we haven't seen before)
    let hasNewFeature = false;
    for (const id of currentIds) {
      if (!seenIds.has(id)) {
        hasNewFeature = true;
        seenIds.add(id);
      }
    }

    // Detect newly completed features
    let hasNewCompletion = false;
    for (const id of currentCompleted) {
      if (!seenCompleted.has(id)) {
        hasNewCompletion = true;
        seenCompleted.add(id);
      }
    }

    // Persist updated sets
    if (hasNewFeature) {
      setSessionSet(SEEN_FEATURES_KEY, seenIds);
    }
    if (hasNewCompletion) {
      setSessionSet(SEEN_COMPLETED_KEY, seenCompleted);
    }

    // Play sounds (completion takes priority if both happen simultaneously)
    if (hasNewCompletion) {
      playSound('feature-completed');
    } else if (hasNewFeature) {
      playSound('feature-created');
    }
  }, [features, playSound]);

  // Renders nothing — purely a side-effect component
  return null;
}
