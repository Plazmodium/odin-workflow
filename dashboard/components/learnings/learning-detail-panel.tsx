'use client';

import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CATEGORY_COLORS, IMPORTANCE_COLORS } from '@/lib/constants';
import { formatConfidence, formatRelativeTime, formatDateTime } from '@/lib/utils';
import type { ActiveLearning } from '@/lib/types/database';

interface LearningDetailPanelProps {
  learning: ActiveLearning;
  onClose: () => void;
}

export function LearningDetailPanel({ learning, onClose }: LearningDetailPanelProps) {
  const categoryColor = CATEGORY_COLORS[learning.category] ?? '#71717a';
  const importanceColors = IMPORTANCE_COLORS[learning.importance];

  return (
    <div className="w-96 border-l border-border bg-card overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card p-4">
        <h3 className="text-sm font-semibold truncate pr-2">Learning Detail</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-5">
        {/* Title & badges */}
        <div>
          <h4 className="text-sm font-medium leading-snug mb-2">{learning.title}</h4>
          <div className="flex flex-wrap gap-1.5">
            <span
              className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: categoryColor }}
            >
              {learning.category}
            </span>
            <Badge
              variant="outline"
              className={`${importanceColors.text} ${importanceColors.bg} border-0`}
            >
              {learning.importance}
            </Badge>
            {learning.propagation_status === 'complete' && (
              <Badge variant="healthy">
                Propagated ({learning.propagated_count}/{learning.total_targets})
              </Badge>
            )}
            {learning.propagation_status === 'partial' && (
              <Badge variant="concerning">
                Partially Propagated ({learning.propagated_count}/{learning.total_targets})
              </Badge>
            )}
            {learning.propagation_status === 'pending' && (
              <Badge variant="secondary">
                Not Propagated (0/{learning.total_targets})
              </Badge>
            )}
          </div>
        </div>

        {/* Confidence */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Confidence</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round(learning.confidence_score * 100)}%`,
                  backgroundColor:
                    learning.confidence_score >= 0.8
                      ? '#22c55e'
                      : learning.confidence_score >= 0.5
                        ? '#f59e0b'
                        : '#ef4444',
                }}
              />
            </div>
            <span className="text-sm font-medium tabular-nums">
              {formatConfidence(learning.confidence_score)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Validated {learning.validation_count} time{learning.validation_count !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Content */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Content</p>
          <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
            {learning.content}
          </div>
        </div>

        {/* Delta Summary */}
        {learning.delta_summary && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Delta from Predecessor</p>
            <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed">
              {learning.delta_summary}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Metadata</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Iteration</span>
              <p className="font-medium">{learning.iteration_number}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Phase</span>
              <p className="font-medium">{learning.phase ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Agent</span>
              <p className="font-medium">{learning.agent ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Created by</span>
              <p className="font-medium">{learning.created_by ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Feature</span>
              <p className="font-medium">{learning.feature_name ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Task</span>
              <p className="font-medium">{learning.task_id ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Tags */}
        {learning.tags.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Tags</p>
            <div className="flex flex-wrap gap-1">
              {learning.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Propagation info */}
        {learning.propagated_to.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Propagated to</p>
            <div className="flex flex-wrap gap-1">
              {learning.propagated_to.map((dest) => (
                <Badge key={dest} variant="outline" className="text-[10px]">
                  {dest}
                </Badge>
              ))}
            </div>
            {learning.propagated_at && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatDateTime(learning.propagated_at)}
              </p>
            )}
          </div>
        )}

        {/* Timestamps */}
        <div className="border-t border-border pt-3 space-y-1 text-[10px] text-muted-foreground">
          <p>Created {formatRelativeTime(learning.created_at)}</p>
          <p>Updated {formatRelativeTime(learning.updated_at)}</p>
          {learning.last_validated_at && (
            <p>Last validated {formatRelativeTime(learning.last_validated_at)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
