/**
 * EvolutionChainTimeline
 *
 * Vertical timeline showing L_n → L_{n+1} evolution of a learning.
 */

import { formatConfidence, formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { LearningChainItem } from '@/lib/types/database';

interface EvolutionChainTimelineProps {
  chain: LearningChainItem[];
  currentLearningId: string;
}

export function EvolutionChainTimeline({
  chain,
  currentLearningId,
}: EvolutionChainTimelineProps) {
  if (chain.length <= 1) {
    return (
      <p className="text-sm text-muted-foreground">
        This learning has no evolution history (single version).
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {chain.map((item, index) => {
        const isCurrent = item.learning_id === currentLearningId;
        const isLast = index === chain.length - 1;

        return (
          <div key={item.learning_id} className="flex gap-3">
            {/* Timeline dot + line */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                  isCurrent
                    ? 'bg-primary/20 border-primary text-primary'
                    : item.learning_is_superseded
                      ? 'bg-zinc-500/10 border-zinc-500/30 text-zinc-500'
                      : 'bg-surface border-border text-muted-foreground'
                }`}
              >
                <span className="text-[10px] font-bold">
                  {item.learning_iteration_number}
                </span>
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-border min-h-[16px]" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-sm font-medium ${
                    isCurrent ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  L<sub>{item.learning_iteration_number}</sub>
                </span>
                {isCurrent && (
                  <Badge variant="default" className="text-[10px]">
                    Current
                  </Badge>
                )}
                {item.learning_is_superseded && (
                  <Badge
                    variant="outline"
                    className="text-[10px] opacity-60"
                  >
                    Superseded
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatConfidence(item.learning_confidence_score)}
                </span>
              </div>
              <p
                className={`text-sm mt-0.5 ${
                  isCurrent ? '' : 'text-muted-foreground'
                }`}
              >
                {item.learning_title}
              </p>
              {item.learning_delta_summary && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-primary/70 font-medium">
                    &Delta;{' '}
                  </span>
                  {item.learning_delta_summary}
                </p>
              )}
              <p className="text-xs text-muted-foreground/50 mt-0.5">
                {formatRelativeTime(item.learning_created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
