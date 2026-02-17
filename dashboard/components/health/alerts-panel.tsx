import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SeverityBadge } from '@/components/shared/status-badge';
import { PanelInfoTooltip } from '@/components/shared/panel-info-tooltip';
import { EmptyState } from '@/components/layout/empty-state';
import { AlertActions } from '@/components/health/alert-actions';
import { formatRelativeTime } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { ActiveEvalAlert } from '@/lib/types/database';
import Link from 'next/link';

interface AlertsPanelProps {
  alerts: ActiveEvalAlert[];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            Active Alerts
            <PanelInfoTooltip text="Unresolved issues requiring attention. Alerts are generated when features have low EVAL scores or exceed expected durations." />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<AlertTriangle className="h-8 w-8" />}
            title="No active alerts"
            description="All systems operating normally"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            Active Alerts
            <PanelInfoTooltip text="Unresolved issues requiring attention. Alerts are generated when features have low EVAL scores or exceed expected durations." />
          </CardTitle>
          <span className="text-xs text-muted-foreground">{alerts.length} active</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 rounded-lg border border-border p-3"
            >
              <SeverityBadge severity={alert.severity} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{alert.dimension}</p>
                    <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
                  </div>
                  <AlertActions
                    alertId={alert.id}
                    isAcknowledged={alert.is_acknowledged}
                  />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {alert.current_value.toFixed(1)} / {alert.threshold.toFixed(1)}
                  </span>
                  <span>·</span>
                  <span>{formatRelativeTime(alert.created_at)}</span>
                  {alert.feature_id && (
                    <>
                      <span>·</span>
                      <Link
                        href={`/features/${alert.feature_id}`}
                        className="text-primary hover:underline"
                      >
                        {alert.feature_name ?? alert.feature_id}
                      </Link>
                    </>
                  )}
                  {alert.is_acknowledged && alert.acknowledged_by && (
                    <>
                      <span>·</span>
                      <span className="text-muted-foreground/60">
                        Ack&apos;d by {alert.acknowledged_by}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
