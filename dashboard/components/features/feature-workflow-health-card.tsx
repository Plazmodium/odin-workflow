import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FeatureWorkflowHealthResult, FeatureWorkflowHealthStatus } from '@/lib/feature-workflow-health';

interface FeatureWorkflowHealthCardProps {
  result: FeatureWorkflowHealthResult;
}

function statusVariant(status: FeatureWorkflowHealthStatus) {
  switch (status) {
    case 'ready':
    case 'complete':
      return 'healthy' as const;
    case 'blocked':
    case 'needs_attention':
      return 'critical' as const;
    case 'waiting_on_review':
    case 'waiting_on_watchers':
    case 'waiting_on_human':
      return 'concerning' as const;
    case 'running':
    default:
      return 'secondary' as const;
  }
}

export function FeatureWorkflowHealthCard({ result }: FeatureWorkflowHealthCardProps) {
  const workflowHealth = result.workflow_health;

  if (workflowHealth == null) {
    return (
      <Card className="border-l-4 border-l-muted">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm">Feature Workflow Health</CardTitle>
              <CardDescription>Runtime-backed feature workflow health is unavailable.</CardDescription>
            </div>
            <Badge variant="outline">unavailable</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            {result.error ?? 'The dashboard could not read odin.get_feature_health for this feature.'}
          </p>
          <p>Use `odin.get_feature_health` in your MCP-enabled coding tool for the authoritative workflow health answer.</p>
        </CardContent>
      </Card>
    );
  }

  const visibleBlockers = workflowHealth.blockers.slice(0, 3);
  const visibleWarnings = workflowHealth.warnings.slice(0, 3);
  const visibleActions = workflowHealth.next_actions.slice(0, 3);

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-sm">Feature Workflow Health</CardTitle>
            <CardDescription>{workflowHealth.summary}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(workflowHealth.status)}>
              {workflowHealth.status.replaceAll('_', ' ')}
            </Badge>
            <Badge variant="outline">{workflowHealth.current_focus.phase_name}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 text-sm lg:grid-cols-3">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Needs Attention</p>
          {visibleBlockers.length === 0 ? (
            <p className="text-muted-foreground">No current blockers.</p>
          ) : (
            <div className="space-y-2">
              {visibleBlockers.map((blocker, index) => (
                <div key={`${blocker.kind}:${index}`} className="space-y-1 rounded-lg border border-border/70 p-2">
                  <Badge variant="outline">{blocker.kind}</Badge>
                  <p>{blocker.message}</p>
                  {blocker.recovery != null && (
                    <p className="text-xs text-muted-foreground">{blocker.recovery}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Warnings</p>
          {visibleWarnings.length === 0 ? (
            <p className="text-muted-foreground">No warnings surfaced.</p>
          ) : (
            <div className="space-y-2">
              {visibleWarnings.map((warning, index) => (
                <div key={`${warning.kind}:${index}`} className="space-y-1 rounded-lg border border-border/70 p-2">
                  <Badge variant="concerning">{warning.kind}</Badge>
                  <p>{warning.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next Actions</p>
          {visibleActions.length === 0 ? (
            <p className="text-muted-foreground">No immediate actions.</p>
          ) : (
            <ol className="space-y-2">
              {visibleActions.map((action, index) => (
                <li key={`${action}:${index}`} className="flex gap-2">
                  <span className="text-muted-foreground">{index + 1}.</span>
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
