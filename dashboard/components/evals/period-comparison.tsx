import { Card, CardContent } from '@/components/ui/card';
import { HealthBadge } from '@/components/shared/status-badge';
import { formatScore, formatRelativeTime, safeJsonValue } from '@/lib/utils';
import type { SystemHealthEval } from '@/lib/types/database';

interface PeriodComparisonProps {
  periods: SystemHealthEval[];
}

export function PeriodComparison({ periods }: PeriodComparisonProps) {
  const periodLabels: Record<number, string> = {
    7: '7-Day',
    30: '30-Day',
    90: '90-Day',
  };

  if (periods.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[7, 30, 90].map((p) => (
          <Card key={p}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{periodLabels[p]} Window</p>
              <p className="text-sm text-muted-foreground">No data</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[7, 30, 90].map((p) => {
        const eval_ = periods.find((e) => e.period_days === p);
        if (!eval_) {
          return (
            <Card key={p}>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">{periodLabels[p]} Window</p>
                <p className="text-sm text-muted-foreground">Not computed</p>
              </CardContent>
            </Card>
          );
        }

        const wm = eval_.workflow_metrics as Record<string, unknown> | null;
        const qm = eval_.quality_metrics as Record<string, unknown> | null;
        const lm = eval_.learning_metrics as Record<string, unknown> | null;

        return (
          <Card key={p}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">{periodLabels[p]} Window</p>
                <HealthBadge status={eval_.health_status} />
              </div>

              <div className="text-center mb-3">
                <p className="text-3xl font-bold tabular-nums">
                  {formatScore(eval_.overall_health_score)}
                </p>
                <p className="text-xs text-muted-foreground">Health Score</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Completed</span>
                  <p className="font-medium">{safeJsonValue(wm, 'features_completed', 0)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">In Progress</span>
                  <p className="font-medium">{safeJsonValue(wm, 'features_in_progress', 0)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Blocked</span>
                  <p className="font-medium">{safeJsonValue(wm, 'features_blocked', 0)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Cycle</span>
                  <p className="font-medium">
                    {safeJsonValue(wm, 'avg_cycle_time_hours', 0) as number > 0
                      ? `${(safeJsonValue(wm, 'avg_cycle_time_hours', 0) as number).toFixed(1)}h`
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Iterations</span>
                  <p className="font-medium">
                    {safeJsonValue(qm, 'avg_iterations_to_approval', 0)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Learnings</span>
                  <p className="font-medium">{safeJsonValue(lm, 'total_learnings', 0)}</p>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground mt-3">
                Computed {formatRelativeTime(eval_.computed_at)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
