import { BlockerStatusBadge, SeverityBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/layout/empty-state';
import { formatRelativeTime } from '@/lib/utils';
import { ShieldAlert } from 'lucide-react';
import type { Blocker } from '@/lib/types/database';

interface BlockersTableProps {
  blockers: Blocker[];
}

export function BlockersTable({ blockers }: BlockersTableProps) {
  if (blockers.length === 0) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6" />}
        title="No blockers"
        description="No blockers recorded for this feature"
      />
    );
  }

  return (
    <div className="space-y-3">
      {blockers.map((blocker) => (
        <div
          key={blocker.id}
          className="rounded-lg border border-border p-3 space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={blocker.severity} />
              <BlockerStatusBadge status={blocker.status} />
              <span className="text-xs text-muted-foreground">{blocker.blocker_type}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(blocker.created_at)}
            </span>
          </div>
          <p className="text-sm font-medium">{blocker.title}</p>
          <p className="text-xs text-muted-foreground">{blocker.description}</p>
          {blocker.resolution_notes && (
            <p className="text-xs text-healthy">
              Resolved: {blocker.resolution_notes}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
