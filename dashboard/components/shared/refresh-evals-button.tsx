'use client';

import { useState, useTransition } from 'react';
import { RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface RefreshEvalsButtonProps {
  action: () => Promise<{ success: boolean; error?: string }>;
  label?: string;
  className?: string;
}

export function RefreshEvalsButton({ action, label = 'Refresh EVALS', className }: RefreshEvalsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? 'Failed to refresh');
      }
    });
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
      >
        <RefreshCw className={cn('mr-2 h-3 w-3', isPending && 'animate-spin')} />
        {isPending ? 'Computing...' : label}
      </Button>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="max-w-[260px]">
            <p>
              Recomputes health scores based on current feature data. Run manually
              after completing features — auto-refresh only fetches existing data.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {error && <span className="text-xs text-critical">{error}</span>}
    </div>
  );
}
