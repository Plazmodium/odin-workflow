import { PhaseBadge } from '@/components/shared/phase-badge';
import { StatusBadge, HealthBadge } from '@/components/shared/status-badge';
import { CopyButton } from '@/components/shared/copy-button';
import { Badge } from '@/components/ui/badge';
import { User } from 'lucide-react';
import { formatDuration, formatRelativeTime } from '@/lib/utils';
import type { FeatureStatusResult } from '@/lib/types/database';
import type { EvalHealth } from '@/lib/types/database';

interface FeatureHeaderProps {
  feature: FeatureStatusResult;
  healthStatus?: EvalHealth | null;
}

export function FeatureHeader({ feature, healthStatus }: FeatureHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{feature.feature_name}</h1>
          </div>
          <div className="flex items-center gap-1">
            <p className="text-sm text-muted-foreground font-mono">{feature.feature_id}</p>
            <CopyButton value={feature.feature_id} label="Copy ID" />
          </div>
        </div>
        <HealthBadge status={healthStatus} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PhaseBadge phase={feature.current_phase} />
        <StatusBadge status={feature.status} />
        <Badge variant="secondary">Level {feature.complexity_level}</Badge>
        <Badge variant="outline">{feature.severity}</Badge>
        {feature.author && (
          <Badge variant="outline" className="gap-1">
            <User className="h-3 w-3" />
            {feature.author}
          </Badge>
        )}
        {feature.assigned_agent && (
          <Badge variant="outline">{feature.assigned_agent}</Badge>
        )}
        {feature.merged_at && (
          <Badge variant="healthy">Merged</Badge>
        )}
      </div>

      {/* Git info row */}
      {feature.branch_name && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-muted-foreground">Branch:</span>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
            {feature.branch_name}
          </code>
          {feature.pr_url && (
            <>
              <span className="text-muted-foreground">PR:</span>
              <a
                href={feature.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-400 hover:text-blue-300 hover:underline"
              >
                #{feature.pr_number}
              </a>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>Duration: <span className="text-foreground font-medium">{formatDuration(feature.total_duration_ms)}</span></span>
        <span>Phases: <span className="text-foreground font-medium">{feature.phase_count}</span></span>
        <span>Transitions: <span className="text-foreground font-medium">{feature.total_transitions}</span></span>
        <span>Learnings: <span className="text-foreground font-medium">{feature.total_learnings}</span></span>
        {feature.open_blockers_count > 0 && (
          <span className="text-critical">Blockers: {feature.open_blockers_count}</span>
        )}
        <span>Created {formatRelativeTime(feature.created_at)}</span>
      </div>
    </div>
  );
}
