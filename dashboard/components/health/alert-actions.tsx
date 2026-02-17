'use client';

/**
 * AlertActions
 *
 * Client component with Acknowledge and Resolve buttons for alerts.
 */

import { useState, useTransition } from 'react';
import { Check, CheckCheck, Loader2 } from 'lucide-react';
import { acknowledgeAlert, resolveAlert } from '@/lib/actions/refresh-evals';

interface AlertActionsProps {
  alertId: string;
  isAcknowledged: boolean;
}

export function AlertActions({ alertId, isAcknowledged }: AlertActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [showResolveInput, setShowResolveInput] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');

  const handleAcknowledge = () => {
    startTransition(async () => {
      await acknowledgeAlert(alertId);
    });
  };

  const handleResolve = () => {
    if (!resolveNotes.trim()) return;
    startTransition(async () => {
      await resolveAlert(alertId, resolveNotes.trim());
      setShowResolveInput(false);
      setResolveNotes('');
    });
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}

      {!isAcknowledged && !isPending && (
        <button
          onClick={handleAcknowledge}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border border-border"
          title="Acknowledge alert"
        >
          <Check className="h-3 w-3" />
          Ack
        </button>
      )}

      {isAcknowledged && !showResolveInput && !isPending && (
        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
          <Check className="h-3 w-3" />
          Ack&apos;d
        </span>
      )}

      {!showResolveInput && !isPending && (
        <button
          onClick={() => setShowResolveInput(true)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-healthy hover:bg-healthy-muted transition-colors border border-border"
          title="Resolve alert"
        >
          <CheckCheck className="h-3 w-3" />
          Resolve
        </button>
      )}

      {showResolveInput && !isPending && (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={resolveNotes}
            onChange={(e) => setResolveNotes(e.target.value)}
            placeholder="Resolution notes..."
            className="rounded border border-border bg-surface px-2 py-1 text-[10px] w-40 focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleResolve();
              if (e.key === 'Escape') {
                setShowResolveInput(false);
                setResolveNotes('');
              }
            }}
            autoFocus
          />
          <button
            onClick={handleResolve}
            disabled={!resolveNotes.trim()}
            className="inline-flex items-center rounded px-2 py-1 text-[10px] font-medium text-healthy hover:bg-healthy-muted transition-colors border border-healthy/30 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <CheckCheck className="h-3 w-3" />
          </button>
          <button
            onClick={() => {
              setShowResolveInput(false);
              setResolveNotes('');
            }}
            className="inline-flex items-center rounded px-1 py-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
