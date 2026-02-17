'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SeverityBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/layout/empty-state';
import { formatRelativeTime, formatDateTime, formatScore } from '@/lib/utils';
import { Bell } from 'lucide-react';
import type { EvalAlert } from '@/lib/types/database';

interface AlertHistoryTableProps {
  alerts: EvalAlert[];
}

type FilterStatus = 'ALL' | 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export function AlertHistoryTable({ alerts }: AlertHistoryTableProps) {
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');

  const filtered = alerts.filter((a) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTIVE') return !a.acknowledged_at && !a.resolved_at;
    if (statusFilter === 'ACKNOWLEDGED') return a.acknowledged_at && !a.resolved_at;
    if (statusFilter === 'RESOLVED') return a.resolved_at;
    return true;
  });

  const activeCount = alerts.filter((a) => !a.acknowledged_at && !a.resolved_at).length;
  const acknowledgedCount = alerts.filter((a) => a.acknowledged_at && !a.resolved_at).length;
  const resolvedCount = alerts.filter((a) => a.resolved_at).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Alert History</CardTitle>
          <div className="flex gap-1">
            {(
              [
                { key: 'ALL', label: `All (${alerts.length})` },
                { key: 'ACTIVE', label: `Active (${activeCount})` },
                { key: 'ACKNOWLEDGED', label: `Ack'd (${acknowledgedCount})` },
                { key: 'RESOLVED', label: `Resolved (${resolvedCount})` },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                  statusFilter === key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-8 w-8" />}
            title="No alerts"
            description={
              statusFilter === 'ALL'
                ? 'No alerts have been generated yet.'
                : `No ${statusFilter.toLowerCase()} alerts.`
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((alert) => {
              const isActive = !alert.acknowledged_at && !alert.resolved_at;
              const isResolved = !!alert.resolved_at;

              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${
                    isResolved
                      ? 'border-border opacity-60'
                      : isActive
                        ? 'border-critical/30 bg-critical-muted/30'
                        : 'border-concerning/30 bg-concerning-muted/30'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityBadge severity={alert.severity} />
                      <span className="text-xs text-muted-foreground">{alert.dimension}</span>
                      <span className="text-xs text-muted-foreground">
                        {alert.source_type}
                        {alert.feature_id ? `: ${alert.feature_id}` : ''}
                      </span>
                    </div>
                    <p className="text-sm">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span>
                        Value: {formatScore(alert.current_value)} (threshold: {formatScore(alert.threshold)})
                      </span>
                      <span>{formatRelativeTime(alert.created_at)}</span>
                    </div>
                    {isResolved && (
                      <div className="mt-1 space-y-0.5">
                        {alert.resolved_by && (
                          <p className="text-[10px] text-muted-foreground">
                            Resolved by {alert.resolved_by} {alert.resolved_at ? `on ${formatDateTime(alert.resolved_at)}` : ''}
                          </p>
                        )}
                        {alert.resolution_notes && (
                          <p className="text-xs text-muted-foreground italic">
                            {alert.resolution_notes}
                          </p>
                        )}
                      </div>
                    )}
                    {!isResolved && alert.acknowledged_at && alert.acknowledged_by && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Acknowledged by {alert.acknowledged_by} {formatRelativeTime(alert.acknowledged_at)}
                      </p>
                    )}
                  </div>

                  {/* Status indicator */}
                  <div className="shrink-0">
                    {isResolved ? (
                      <Badge variant="healthy">Resolved</Badge>
                    ) : alert.acknowledged_at ? (
                      <Badge variant="concerning">Acknowledged</Badge>
                    ) : (
                      <Badge variant="critical">Active</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
