'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CATEGORY_COLORS, IMPORTANCE_COLORS } from '@/lib/constants';
import { formatConfidence, formatRelativeTime, truncate } from '@/lib/utils';
import { EmptyState } from '@/components/layout/empty-state';
import { ArrowUpCircle } from 'lucide-react';
import type { PropagationQueueItem } from '@/lib/types/database';

interface PropagationQueueTableProps {
  items: PropagationQueueItem[];
}

export function PropagationQueueTable({ items }: PropagationQueueTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ArrowUpCircle className="h-8 w-8" />}
        title="No learnings ready for propagation"
        description="Learnings need confidence >= 80% and no open conflicts to appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const categoryColor = CATEGORY_COLORS[item.category] ?? '#71717a';
        const importanceColors = IMPORTANCE_COLORS[item.importance];

        return (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Title & badges */}
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-white shrink-0"
                      style={{ backgroundColor: categoryColor }}
                    >
                      {item.category}
                    </span>
                    <Badge
                      variant="outline"
                      className={`${importanceColors.text} ${importanceColors.bg} border-0 shrink-0`}
                    >
                      {item.importance}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-medium leading-snug">{item.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {truncate(item.content, 200)}
                  </p>

                  {/* Suggested summary */}
                  {item.suggested_summary && (
                    <div className="mt-2 rounded bg-muted/50 p-2">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Suggested summary:</p>
                      <p className="text-xs">{item.suggested_summary}</p>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                    {item.feature_name && <span>{item.feature_name}</span>}
                    {item.created_by && <span>by {item.created_by}</span>}
                    <span>{formatRelativeTime(item.created_at)}</span>
                  </div>
                </div>

                {/* Confidence */}
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold tabular-nums text-healthy">
                    {formatConfidence(item.confidence_score)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.validation_count} validation{item.validation_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Tags */}
              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
