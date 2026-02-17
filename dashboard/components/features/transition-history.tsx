import { PhaseBadge } from '@/components/shared/phase-badge';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import type { PhaseTransition } from '@/lib/types/database';

interface TransitionHistoryProps {
  transitions: PhaseTransition[];
}

export function TransitionHistory({ transitions }: TransitionHistoryProps) {
  if (transitions.length === 0) {
    return <p className="text-sm text-muted-foreground">No transitions recorded</p>;
  }

  return (
    <div className="space-y-2">
      {transitions.map((t) => (
        <div key={t.id} className="flex items-center gap-3 text-sm">
          <span className="text-xs text-muted-foreground w-32 shrink-0">
            {formatDateTime(t.transitioned_at)}
          </span>
          <PhaseBadge phase={t.from_phase} />
          <span className="text-muted-foreground">→</span>
          <PhaseBadge phase={t.to_phase} />
          {t.transition_type !== 'FORWARD' && (
            <Badge variant={t.transition_type === 'BACKWARD' ? 'concerning' : 'critical'}>
              {t.transition_type}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground truncate flex-1">
            {t.transitioned_by}
            {t.notes && ` — ${t.notes}`}
          </span>
        </div>
      ))}
    </div>
  );
}
