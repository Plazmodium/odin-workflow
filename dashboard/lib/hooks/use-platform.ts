'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to detect the user's platform for keyboard shortcut display.
 * Returns platform info and the appropriate modifier key.
 * 
 * Defaults to macOS on SSR to avoid hydration mismatch,
 * then updates on client mount.
 */
export function usePlatform() {
  const [isMac, setIsMac] = useState(true); // Default for SSR

  useEffect(() => {
    const platform = navigator.platform?.toLowerCase() || '';
    const userAgent = navigator.userAgent?.toLowerCase() || '';
    
    const isMacOS = 
      platform.includes('mac') || 
      userAgent.includes('macintosh') ||
      userAgent.includes('mac os');
    
    setIsMac(isMacOS);
  }, []);

  return {
    isMac,
    modifierKey: (isMac ? 'metaKey' : 'ctrlKey') as 'metaKey' | 'ctrlKey',
    modifierSymbol: isMac ? '⌘' : 'Ctrl+',
  };
}
