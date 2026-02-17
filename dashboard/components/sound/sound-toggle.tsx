'use client';

/**
 * SoundToggle
 *
 * Mute/unmute toggle button for workflow sound notifications.
 * Displayed in the sidebar footer alongside the RefreshIndicator.
 */

import { Volume2, VolumeX } from 'lucide-react';
import { useSoundNotification } from '@/lib/sound/sound-provider';

export function SoundToggle() {
  const { isMuted, toggleMute } = useSoundNotification();

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5">
        {isMuted ? (
          <VolumeX className="h-3 w-3 text-muted-foreground" />
        ) : (
          <Volume2 className="h-3 w-3 text-emerald-500" />
        )}
        <span className="text-muted-foreground">
          {isMuted ? 'Sounds off' : 'Sounds on'}
        </span>
      </div>
      <button
        onClick={toggleMute}
        className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
        title={isMuted ? 'Enable sound notifications' : 'Mute sound notifications'}
      >
        {isMuted ? (
          <Volume2 className="h-3 w-3" />
        ) : (
          <VolumeX className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
