import { Badge } from '@/components/ui/badge';
import { phaseName } from '@/lib/utils';
import type { Phase } from '@/lib/types/database';

interface PhaseBadgeProps {
  phase: Phase | string;
  className?: string;
}

export function PhaseBadge({ phase, className }: PhaseBadgeProps) {
  return (
    <Badge variant="secondary" className={className}>
      {phaseName(phase)}
    </Badge>
  );
}
