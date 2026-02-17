import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { HealthBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/layout/empty-state';
import { formatScore, formatMinutes } from '@/lib/utils';
import { BarChart3 } from 'lucide-react';
import type { FeatureEval } from '@/lib/types/database';

interface EvalBreakdownProps {
  eval_: FeatureEval | null;
}

export function EvalBreakdown({ eval_ }: EvalBreakdownProps) {
  if (!eval_) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-6 w-6" />}
        title="No evaluations computed"
        description="Run compute_feature_eval() to generate health scores"
      />
    );
  }

  const eb = eval_.efficiency_breakdown;
  const qb = eval_.quality_breakdown;

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-3xl font-bold">{formatScore(eval_.overall_score)}</p>
          <p className="text-xs text-muted-foreground">Overall</p>
        </div>
        <HealthBadge status={eval_.health_status} />
      </div>

      {/* Sub-scores */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Efficiency</span>
            <span className="text-sm font-medium">{formatScore(eval_.efficiency_score)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${eval_.efficiency_score ?? 0}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Quality</span>
            <span className="text-sm font-medium">{formatScore(eval_.quality_score)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500"
              style={{ width: `${eval_.quality_score ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Breakdown Details */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs">Efficiency Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>Duration</span>
              <span className="text-foreground">{formatMinutes(eb?.total_duration_minutes)}</span>
            </div>
            <div className="flex justify-between">
              <span>Expected</span>
              <span className="text-foreground">{formatMinutes(eb?.expected_duration_minutes)}</span>
            </div>
            <div className="flex justify-between">
              <span>Ratio</span>
              <span className="text-foreground">{eb?.duration_ratio?.toFixed(2) ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Invocations</span>
              <span className="text-foreground">{eb?.agent_invocations ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Iterations</span>
              <span className="text-foreground">{eb?.iterations ?? '—'}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs">Quality Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>Approvals</span>
              <span className="text-foreground">{qb?.approvals ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Rejections</span>
              <span className="text-foreground">{qb?.rejections ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Approval Rate</span>
              <span className="text-foreground">{qb?.approval_rate != null ? `${qb.approval_rate.toFixed(0)}%` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Thrashing</span>
              <span className="text-foreground">{qb?.thrashing_incidents ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Blockers</span>
              <span className="text-foreground">{qb?.blocker_count ?? '—'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
