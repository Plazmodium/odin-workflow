/**
 * PropagationStatusTable
 *
 * Shows all propagation targets for a learning with their status.
 */

import { CheckCircle, Clock } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/layout/empty-state';
import type { PropagationStatus } from '@/lib/types/database';

interface PropagationStatusTableProps {
  targets: PropagationStatus[];
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  agents_md: 'AGENTS.md',
  skill: 'Skill',
  agent_definition: 'Agent Definition',
};

export function PropagationStatusTable({
  targets,
}: PropagationStatusTableProps) {
  if (targets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No propagation targets declared for this learning.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-4">Target</th>
            <th className="pb-2 pr-4">Path</th>
            <th className="pb-2 pr-4">Relevance</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2">Propagated</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((t, i) => (
            <tr key={i} className="border-b border-border/50">
              <td className="py-2 pr-4">
                <Badge variant="outline" className="text-xs">
                  {TARGET_TYPE_LABELS[t.target_type] ?? t.target_type}
                </Badge>
              </td>
              <td className="py-2 pr-4 text-xs text-muted-foreground font-mono">
                {t.target_path ?? '—'}
              </td>
              <td className="py-2 pr-4 text-xs tabular-nums">
                {(t.relevance_score * 100).toFixed(0)}%
              </td>
              <td className="py-2 pr-4">
                {t.is_propagated ? (
                  <span className="inline-flex items-center gap-1 text-xs text-healthy">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Done
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-concerning">
                    <Clock className="h-3.5 w-3.5" />
                    Pending
                  </span>
                )}
              </td>
              <td className="py-2 text-xs text-muted-foreground">
                {t.propagated_at
                  ? formatRelativeTime(t.propagated_at)
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
