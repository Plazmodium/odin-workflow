import Link from 'next/link';

import { Bot, CheckCircle2, Clock3, PauseCircle, TriangleAlert, XCircle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RalphLoopStatus } from '@/lib/types/database';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';

interface RalphLoopPanelProps {
  status: RalphLoopStatus;
}

function outcomeBadge(status: RalphLoopStatus['latest_outcome']) {
  switch (status) {
    case 'running':
      return <Badge variant="concerning">Running</Badge>;
    case 'selected':
      return <Badge variant="outline">Picked Work</Badge>;
    case 'noop':
      return <Badge variant="secondary">No-Op</Badge>;
    case 'failed':
      return <Badge variant="critical">Failed</Badge>;
    case 'completed':
      return <Badge variant="healthy">Completed</Badge>;
    case 'idle':
    default:
      return <Badge variant="outline">Idle</Badge>;
  }
}

export function RalphLoopPanel({ status }: RalphLoopPanelProps) {
  const hasTick = status.last_tick_at != null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            Ralph Loop
          </CardTitle>
          {outcomeBadge(status.latest_outcome)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              Last Tick
            </div>
            {hasTick ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">{formatRelativeTime(status.last_tick_at)}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(status.last_tick_at)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No Ralph Loop ticks recorded yet.</p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Selected Work
            </div>
            {status.last_selected_feature_id == null ? (
              <p className="text-sm text-muted-foreground">No feature selected yet.</p>
            ) : (
              <div className="space-y-1">
                <Link href={`/features/${status.last_selected_feature_id}`} className="text-sm font-medium text-blue-400 hover:underline">
                  {status.last_selected_feature_id}
                </Link>
                <p className="text-xs text-muted-foreground">Phase {status.last_selected_phase ?? 'unknown'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <PauseCircle className="h-3.5 w-3.5" />
              Last No-Op
            </div>
            <p className="text-sm text-muted-foreground">
              {status.last_noop_reason ?? 'No no-op reason recorded yet.'}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <TriangleAlert className="h-3.5 w-3.5" />
              Last Failure
            </div>
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-critical" />
              <p className="text-sm text-muted-foreground">
                {status.last_failure_summary ?? 'No failures recorded yet.'}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
