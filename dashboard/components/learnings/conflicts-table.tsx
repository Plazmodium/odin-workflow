'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/layout/empty-state';
import { CATEGORY_COLORS } from '@/lib/constants';
import { formatConfidence, formatRelativeTime } from '@/lib/utils';
import { ShieldAlert, ArrowLeftRight } from 'lucide-react';
import type { OpenConflict } from '@/lib/types/database';

interface ConflictsTableProps {
  conflicts: OpenConflict[];
}

const CONFLICT_TYPE_LABELS: Record<string, string> = {
  CONTRADICTION: 'Contradiction',
  SCOPE_OVERLAP: 'Scope Overlap',
  VERSION_DRIFT: 'Version Drift',
};

const CONFLICT_STATUS_VARIANT: Record<string, 'critical' | 'concerning' | 'healthy' | 'outline'> = {
  OPEN: 'critical',
  INVESTIGATING: 'concerning',
  RESOLVED: 'healthy',
  DEFERRED: 'outline',
};

export function ConflictsTable({ conflicts }: ConflictsTableProps) {
  if (conflicts.length === 0) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-8 w-8" />}
        title="No open conflicts"
        description="All learning conflicts have been resolved. The knowledge base is consistent."
      />
    );
  }

  return (
    <div className="space-y-3">
      {conflicts.map((conflict) => {
        const colorA = CATEGORY_COLORS[conflict.learning_a_category] ?? '#71717a';
        const colorB = CATEGORY_COLORS[conflict.learning_b_category] ?? '#71717a';

        return (
          <Card key={conflict.id} className="border-critical/30">
            <CardContent className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant={CONFLICT_STATUS_VARIANT[conflict.status] ?? 'outline'}>
                    {conflict.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {CONFLICT_TYPE_LABELS[conflict.conflict_type] ?? conflict.conflict_type}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {Math.round(conflict.hours_open)}h open
                </span>
              </div>

              {/* Description */}
              <p className="text-sm mb-3">{conflict.description}</p>

              {/* Conflicting learnings */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                {/* Learning A */}
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: colorA }}
                    >
                      {conflict.learning_a_category}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {formatConfidence(conflict.learning_a_confidence)}
                    </span>
                  </div>
                  <p className="text-xs font-medium leading-snug">{conflict.learning_a_title}</p>
                  {conflict.learning_a_feature_id && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {conflict.learning_a_feature_id}
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <div className="hidden md:flex items-center justify-center">
                  <ArrowLeftRight className="h-4 w-4 text-critical" />
                </div>

                {/* Learning B */}
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: colorB }}
                    >
                      {conflict.learning_b_category}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {formatConfidence(conflict.learning_b_confidence)}
                    </span>
                  </div>
                  <p className="text-xs font-medium leading-snug">{conflict.learning_b_title}</p>
                  {conflict.learning_b_feature_id && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {conflict.learning_b_feature_id}
                    </p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
                <span>Detected {formatRelativeTime(conflict.detected_at)}</span>
                {conflict.detected_by && <span>by {conflict.detected_by}</span>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
