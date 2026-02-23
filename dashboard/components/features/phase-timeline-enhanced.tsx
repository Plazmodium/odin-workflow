'use client';

/**
 * PhaseTimelineEnhanced
 *
 * Clickable, expandable phase timeline showing agent invocations,
 * quality gates, and blockers per phase.
 */

import { useState } from 'react';
import { ChevronDown, Clock, CheckCircle, XCircle, AlertTriangle, BookOpen, ListChecks, Eye, ClipboardList } from 'lucide-react';
import { cn, formatMinutes, formatDuration, phaseName } from '@/lib/utils';
import { getPhaseOutputArray } from '@/lib/phase-output-content';
import { Badge } from '@/components/ui/badge';
import { GATE_COLORS, BLOCKER_SEVERITY_COLORS } from '@/lib/constants';
import type {
  PhaseDuration,
  Phase,
  AgentInvocation,
  QualityGate,
  Blocker,
  PhaseTransition,
  PhaseOutput,
  RequirementItem,
  PerspectiveItem,
  TaskItem,
} from '@/lib/types/database';

interface PhaseTimelineEnhancedProps {
  phases: PhaseDuration[];
  currentPhase: Phase;
  featureStatus?: string;
  invocations: AgentInvocation[];
  gates: QualityGate[];
  blockers: Blocker[];
  transitions: PhaseTransition[];
  phaseOutputs?: PhaseOutput[];
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'text-red-400 border-red-500/30',
  MEDIUM: 'text-amber-400 border-amber-500/30',
  LOW: 'text-zinc-400 border-zinc-500/30',
};

const RATING_COLORS: Record<string, string> = {
  Good: 'text-healthy border-healthy/30 bg-healthy/10',
  'Needs Work': 'text-concerning border-concerning/30 bg-concerning/10',
  Blocking: 'text-critical border-critical/30 bg-critical/10',
};

const TASK_STATUS_COLORS: Record<string, string> = {
  completed: 'text-healthy',
  in_progress: 'text-primary',
  pending: 'text-muted-foreground',
};

/** Normalize task status values — workflow may record 'done' instead of 'completed' */
function normalizeTaskStatus(status: string): 'pending' | 'in_progress' | 'completed' {
  if (status === 'done' || status === 'completed') return 'completed';
  if (status === 'in_progress') return 'in_progress';
  return 'pending';
}

const ALL_PHASES: Phase[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];

export function PhaseTimelineEnhanced({
  phases,
  currentPhase,
  featureStatus,
  invocations,
  gates,
  blockers,
  transitions,
  phaseOutputs = [],
}: PhaseTimelineEnhancedProps) {
  const [expandedPhase, setExpandedPhase] = useState<Phase | null>(null);
  const phaseMap = new Map(phases.map((p) => [p.phase, p]));
  // If feature is COMPLETED, treat all phases as done regardless of currentPhase value
  const isFeatureCompleted = featureStatus === 'COMPLETED';
  const currentPhaseNum = isFeatureCompleted ? 9 : parseInt(currentPhase, 10);

  // Group data by phase
  const invocationsByPhase = new Map<string, AgentInvocation[]>();
  for (const inv of invocations) {
    const key = inv.phase;
    if (!invocationsByPhase.has(key)) invocationsByPhase.set(key, []);
    invocationsByPhase.get(key)!.push(inv);
  }

  const gatesByPhase = new Map<string, QualityGate[]>();
  for (const gate of gates) {
    const key = gate.phase;
    if (!gatesByPhase.has(key)) gatesByPhase.set(key, []);
    gatesByPhase.get(key)!.push(gate);
  }

  const blockersByPhase = new Map<string, Blocker[]>();
  for (const blocker of blockers) {
    const key = blocker.phase;
    if (!blockersByPhase.has(key)) blockersByPhase.set(key, []);
    blockersByPhase.get(key)!.push(blocker);
  }

  const outputsByPhase = new Map<string, PhaseOutput[]>();
  for (const output of phaseOutputs) {
    const key = output.phase;
    if (!outputsByPhase.has(key)) outputsByPhase.set(key, []);
    outputsByPhase.get(key)!.push(output);
  }

  // Compute latest task progress for the phase bar indicator
  // The latest (highest phase) task output represents the most up-to-date statuses
  let latestTasks: TaskItem[] = [];
  for (const output of phaseOutputs) {
    if (output.output_type === 'tasks') {
      // Always overwrite — we iterate in phase order (ascending), so last wins
      latestTasks = getPhaseOutputArray<TaskItem>(output.content, ['tasks']).map((t) => ({
        ...t,
        status: normalizeTaskStatus(t.status),
      }));
    }
  }
  const tasksDone = latestTasks.filter((t) => normalizeTaskStatus(t.status) === 'completed').length;
  const tasksTotal = latestTasks.length;
  const hasTaskProgress = tasksTotal > 0;

  // Check for backward transitions
  const backwardPhases = new Set<string>();
  for (const t of transitions) {
    if (t.transition_type === 'BACKWARD') {
      backwardPhases.add(t.to_phase);
    }
  }

  const togglePhase = (phase: Phase) => {
    setExpandedPhase((prev) => (prev === phase ? null : phase));
  };

  return (
    <div className="space-y-2">
      {/* Phase bars */}
      <div className="flex items-center gap-1">
        {ALL_PHASES.map((phase) => {
          const phaseNum = parseInt(phase, 10);
          const data = phaseMap.get(phase);
          const isCompleted = phaseNum < currentPhaseNum;
          const isCurrent = phaseNum === currentPhaseNum;
          const isFuture = phaseNum > currentPhaseNum;
          const isExpanded = expandedPhase === phase;
          const hasBackward = backwardPhases.has(phase);
          const hasData = data || invocationsByPhase.has(phase) || gatesByPhase.has(phase) || blockersByPhase.has(phase) || outputsByPhase.has(phase);

          return (
            <div key={phase} className="flex-1 group relative">
              {/* Bar */}
              <button
                onClick={() => hasData ? togglePhase(phase) : undefined}
                className={cn(
                  'w-full h-8 rounded-md flex items-center justify-center text-xs font-medium transition-colors relative',
                  isCompleted && 'bg-healthy/20 text-healthy border border-healthy/30',
                  isCurrent && 'bg-primary/20 text-primary border border-primary/50',
                  isCurrent && !isExpanded && 'animate-pulse',
                  isFuture && 'bg-muted text-muted-foreground border border-border',
                  isExpanded && 'ring-1 ring-primary',
                  hasData && !isFuture && 'cursor-pointer hover:brightness-125',
                  hasBackward && 'ring-1 ring-orange-500/50'
                )}
              >
                <span className="truncate px-1">{phaseName(phase)}</span>
                {hasData && !isFuture && (
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 absolute right-0.5 top-0.5 opacity-40 transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                  />
                )}
              </button>

              {/* Duration label + task progress - always show to maintain alignment */}
              <div className="text-[10px] text-muted-foreground text-center mt-1 h-4 flex items-center justify-center gap-1">
                {data && data.duration_minutes > 0 ? (
                  <span>
                    {formatMinutes(data.duration_minutes)}
                    {data.agent_invocation_count > 0 && (
                      <span className="ml-0.5">({data.agent_invocation_count})</span>
                    )}
                  </span>
                ) : (isCompleted || isCurrent) ? (
                  <span>&lt;1m</span>
                ) : (
                  <span className="opacity-0">—</span>
                )}
                {hasTaskProgress && isCurrent && (
                  <span className={cn(
                    'font-medium',
                    tasksDone === tasksTotal ? 'text-healthy' : 'text-primary'
                  )}>
                    {tasksDone}/{tasksTotal} ✓
                  </span>
                )}
              </div>

              {/* Backward transition indicator */}
              {hasBackward && (
                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-orange-500 border border-background" title="Rework occurred in this phase" />
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded detail panel */}
      {expandedPhase && (
        <div className="border border-border rounded-lg p-4 bg-surface/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              {phaseName(expandedPhase)} Phase
              {phaseMap.get(expandedPhase) && (
                <span className="text-muted-foreground ml-2">
                  ({formatMinutes(phaseMap.get(expandedPhase)!.duration_minutes)})
                </span>
              )}
            </h4>
            {backwardPhases.has(expandedPhase) && (
              <Badge variant="outline" className="text-orange-400 border-orange-500/30 text-[10px]">
                Rework
              </Badge>
            )}
          </div>

          {/* Agent Invocations */}
          <div>
            <h5 className="text-xs font-medium text-muted-foreground mb-2">
              Agent Invocations ({invocationsByPhase.get(expandedPhase)?.length ?? 0})
            </h5>
            {(invocationsByPhase.get(expandedPhase) ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground/60">No invocations in this phase</p>
            ) : (
              <div className="space-y-2">
                {invocationsByPhase.get(expandedPhase)!.map((inv) => (
                  <div key={inv.id} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium">{inv.agent_name}</span>
                      {inv.operation && (
                        <span className="text-muted-foreground truncate">
                          {inv.operation}
                        </span>
                      )}
                      <span className="ml-auto text-muted-foreground tabular-nums shrink-0">
                        {formatDuration(inv.duration_ms)}
                      </span>
                    </div>
                    {inv.skills_used && inv.skills_used.length > 0 && (
                      <div className="flex items-center gap-1 ml-5 flex-wrap">
                        <BookOpen className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
                        {inv.skills_used.map((skill) => (
                          <Badge
                            key={skill}
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-4 text-muted-foreground border-border/50"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Phase Outputs */}
          {(outputsByPhase.get(expandedPhase) ?? []).map((output) => (
            <div key={output.id}>
              {output.output_type === 'requirements' && (
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <ClipboardList className="h-3 w-3" />
                    Requirements ({getPhaseOutputArray<RequirementItem>(output.content, ['functional_requirements', 'requirements']).length})
                  </h5>
                  <div className="space-y-1">
                    {getPhaseOutputArray<RequirementItem>(output.content, ['functional_requirements', 'requirements']).map((req) => (
                      <div key={req.id} className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-muted-foreground/60 shrink-0 w-12">{req.id}</span>
                        <span className="flex-1 truncate">{req.title}</span>
                        <Badge variant="outline" className={`text-[9px] ${PRIORITY_COLORS[req.priority] ?? ''}`}>
                          {req.priority}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {output.output_type === 'perspectives' && (
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Eye className="h-3 w-3" />
                    Perspectives ({getPhaseOutputArray<PerspectiveItem>(output.content, ['perspectives']).length})
                  </h5>
                  <div className="space-y-2">
                    {getPhaseOutputArray<PerspectiveItem>(output.content, ['perspectives']).map((p) => (
                      <div key={p.name} className="space-y-0.5">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium">{p.name}</span>
                          <Badge variant="outline" className={`text-[9px] ${RATING_COLORS[p.rating] ?? ''}`}>
                            {p.rating}
                          </Badge>
                        </div>
                        {p.notes && (
                          <p className="text-[11px] text-muted-foreground/70 ml-0 leading-relaxed">
                            {p.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {output.output_type === 'tasks' && (() => {
                const tasks = getPhaseOutputArray<TaskItem>(output.content, ['tasks']);
                const normalizedTasks = tasks.map((t) => ({ ...t, status: normalizeTaskStatus(t.status) }));
                const done = normalizedTasks.filter((t) => t.status === 'completed').length;
                return (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <ListChecks className="h-3 w-3" />
                      Tasks ({done}/{tasks.length})
                    </h5>
                    <div className="space-y-1">
                      {normalizedTasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-2 text-xs">
                          {task.status === 'completed' ? (
                            <CheckCircle className={`h-3 w-3 shrink-0 ${TASK_STATUS_COLORS.completed}`} />
                          ) : task.status === 'in_progress' ? (
                            <Clock className={`h-3 w-3 shrink-0 ${TASK_STATUS_COLORS.in_progress}`} />
                          ) : (
                            <div className="h-3 w-3 shrink-0 rounded-full border border-muted-foreground/40" />
                          )}
                          <span className="font-mono text-muted-foreground/60 shrink-0 w-16">{task.id}</span>
                          <span className={cn(
                            'flex-1 truncate',
                            task.status === 'completed' && 'line-through text-muted-foreground/60'
                          )}>
                            {task.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}

          {/* Quality Gates */}
          <div>
            <h5 className="text-xs font-medium text-muted-foreground mb-2">
              Quality Gates ({gatesByPhase.get(expandedPhase)?.length ?? 0})
            </h5>
            {(gatesByPhase.get(expandedPhase) ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground/60">No gates in this phase</p>
            ) : (
              <div className="space-y-1">
                {gatesByPhase.get(expandedPhase)!.map((gate) => {
                  const colors = GATE_COLORS[gate.status];
                  return (
                    <div key={gate.id} className="flex items-center gap-2 text-xs">
                      {gate.status === 'APPROVED' ? (
                        <CheckCircle className="h-3 w-3 text-healthy shrink-0" />
                      ) : gate.status === 'REJECTED' ? (
                        <XCircle className="h-3 w-3 text-critical shrink-0" />
                      ) : (
                        <Clock className="h-3 w-3 text-concerning shrink-0" />
                      )}
                      <span className="font-medium">{gate.gate_name}</span>
                      <Badge variant="outline" className={`${colors.text} text-[10px]`}>
                        {gate.status}
                      </Badge>
                      {gate.approval_notes && (
                        <span className="text-muted-foreground truncate">
                          {gate.approval_notes}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Blockers */}
          <div>
            <h5 className="text-xs font-medium text-muted-foreground mb-2">
              Blockers ({blockersByPhase.get(expandedPhase)?.length ?? 0})
            </h5>
            {(blockersByPhase.get(expandedPhase) ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground/60">No blockers in this phase</p>
            ) : (
              <div className="space-y-1">
                {blockersByPhase.get(expandedPhase)!.map((blocker) => {
                  const sevColors = BLOCKER_SEVERITY_COLORS[blocker.severity];
                  return (
                    <div key={blocker.id} className="flex items-center gap-2 text-xs">
                      <AlertTriangle className={`h-3 w-3 shrink-0 ${sevColors.text}`} />
                      <span className="font-medium truncate">{blocker.title}</span>
                      <Badge variant="outline" className={`${sevColors.text} text-[10px]`}>
                        {blocker.severity}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          blocker.status === 'RESOLVED' && 'text-healthy',
                          blocker.status === 'OPEN' && 'text-critical',
                          blocker.status === 'IN_PROGRESS' && 'text-concerning'
                        )}
                      >
                        {blocker.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
