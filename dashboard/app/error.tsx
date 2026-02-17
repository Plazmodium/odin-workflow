'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Odin Dashboard] Error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <AlertTriangle className="h-16 w-16 text-critical mb-4" />
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-sm text-muted-foreground mb-2 max-w-md">
        An error occurred while loading this page. This might be a temporary issue with the database connection.
      </p>
      {error.message && (
        <p className="text-xs text-critical mb-6 max-w-md font-mono bg-critical-muted rounded-lg p-3">
          {error.message}
        </p>
      )}
      <Button variant="outline" onClick={reset}>
        Try Again
      </Button>
    </div>
  );
}
