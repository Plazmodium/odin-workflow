'use client';

import { cn } from '@/lib/utils';
import { formatMinutes, phaseName } from '@/lib/utils';
import type { PhaseDuration, Phase } from '@/lib/types/database';

interface PhaseTimelineProps {
  phases: PhaseDuration[];
  currentPhase: Phase;
}

const ALL_PHASES: Phase[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];

export function PhaseTimeline({ phases, currentPhase }: PhaseTimelineProps) {
  const phaseMap = new Map(phases.map((p) => [p.phase, p]));
  const currentPhaseNum = parseInt(currentPhase, 10);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {ALL_PHASES.map((phase) => {
          const phaseNum = parseInt(phase, 10);
          const data = phaseMap.get(phase);
          const isCompleted = phaseNum < currentPhaseNum;
          const isCurrent = phaseNum === currentPhaseNum;
          const isFuture = phaseNum > currentPhaseNum;

          return (
            <div key={phase} className="flex-1 group relative">
              {/* Bar */}
              <div
                className={cn(
                  'h-8 rounded-md flex items-center justify-center text-xs font-medium transition-colors',
                  isCompleted && 'bg-healthy/20 text-healthy border border-healthy/30',
                  isCurrent && 'bg-primary/20 text-primary border border-primary/50 animate-pulse',
                  isFuture && 'bg-muted text-muted-foreground border border-border'
                )}
              >
                <span className="truncate px-1">{phaseName(phase)}</span>
              </div>

              {/* Duration label */}
              {data && data.duration_minutes > 0 && (
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  {formatMinutes(data.duration_minutes)}
                  {data.agent_invocation_count > 0 && (
                    <span className="ml-1">({data.agent_invocation_count})</span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
