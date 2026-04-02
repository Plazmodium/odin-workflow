import type {
  AutomationDecision,
  AutonomyFeatureState,
  FeatureRecord,
  PhaseId,
  QualityGateRecord,
} from '../types.js';

export interface AutonomousFeatureStateInput {
  feature: FeatureRecord;
  automation: AutomationDecision;
  open_blockers: string[];
  open_gate_records: QualityGateRecord[];
  open_findings: string[];
  pending_claims: string[];
  claims_needing_review_count: number;
  has_open_invocation: boolean;
}

export interface AutonomousQueueEntry {
  feature: FeatureRecord;
  automation: AutomationDecision;
  state: AutonomyFeatureState;
}

function primaryBlockingReason(blocking_reasons: string[]): string {
  return blocking_reasons[0] ?? 'This feature is not ready for autonomous pickup.';
}

function severityRank(severity: FeatureRecord['severity']): number {
  switch (severity) {
    case 'CRITICAL':
      return 0;
    case 'EXPEDITED':
      return 1;
    case 'ROUTINE':
    default:
      return 2;
  }
}

export function deriveAutonomyFeatureState(input: AutonomousFeatureStateInput): AutonomyFeatureState {
  if (input.feature.status === 'COMPLETED' || input.feature.current_phase === '10') {
    return {
      status: 'completed',
      detail: 'Feature is already completed.',
      can_pick_now: false,
      selection_reason: null,
    };
  }

  if (input.has_open_invocation) {
    return {
      status: 'running',
      detail: 'Feature already has an open agent invocation.',
      can_pick_now: false,
      selection_reason: null,
    };
  }

  if (input.feature.status === 'BLOCKED' || input.open_blockers.length > 0) {
    return {
      status: 'blocked',
      detail: input.open_blockers[0] ?? 'Feature status is BLOCKED.',
      can_pick_now: false,
      selection_reason: null,
    };
  }

  if (input.claims_needing_review_count > 0 || input.pending_claims.length > 0) {
    return {
      status: 'waiting_on_watchers',
      detail:
        input.claims_needing_review_count > 0
          ? `${input.claims_needing_review_count} claim(s) still need watcher review.`
          : `${input.pending_claims.length} claim(s) still need policy resolution.`,
      can_pick_now: false,
      selection_reason: null,
    };
  }

  if (input.open_gate_records.length > 0 || input.open_findings.length > 0) {
    return {
      status: 'waiting_on_review',
      detail:
        input.open_gate_records.length > 0
          ? `${input.open_gate_records.length} quality gate(s) are still open.`
          : `${input.open_findings.length} security finding(s) are still unresolved.`,
      can_pick_now: false,
      selection_reason: null,
    };
  }

  if (input.feature.current_phase === '9') {
    if (input.feature.merged_at != null) {
      return {
        status: 'ready_for_phase',
        detail: 'Pull request is merged; Release can close the feature.',
        can_pick_now: true,
        selection_reason: 'merged_and_ready_to_close_release',
      };
    }

    if (input.feature.pr_url != null) {
      return {
        status: 'waiting_on_human_merge',
        detail: 'Pull request is recorded and waiting for a human merge.',
        can_pick_now: false,
        selection_reason: null,
      };
    }

    if (!input.automation.capabilities.can_open_pr) {
      return {
        status: 'waiting_on_human_pr',
        detail: primaryBlockingReason(input.automation.blocking_reasons),
        can_pick_now: false,
        selection_reason: null,
      };
    }
  }

  return {
    status: 'ready_for_phase',
    detail: `Phase ${input.feature.current_phase} is eligible for autonomous pickup.`,
    can_pick_now: true,
    selection_reason: 'ready_for_phase',
  };
}

export function pickAutonomousQueueEntry(entries: AutonomousQueueEntry[]): AutonomousQueueEntry | null {
  const ready = entries.filter((entry) => entry.state.can_pick_now);
  if (ready.length === 0) {
    return null;
  }

  return [...ready].sort((left, right) => {
    const left_release_closeout = left.state.selection_reason === 'merged_and_ready_to_close_release' ? 0 : 1;
    const right_release_closeout = right.state.selection_reason === 'merged_and_ready_to_close_release' ? 0 : 1;
    if (left_release_closeout !== right_release_closeout) {
      return left_release_closeout - right_release_closeout;
    }

    const severity_delta = severityRank(left.feature.severity) - severityRank(right.feature.severity);
    if (severity_delta !== 0) {
      return severity_delta;
    }

    return left.feature.created_at.localeCompare(right.feature.created_at);
  })[0] ?? null;
}

export function currentAutonomousPhase(feature: FeatureRecord): PhaseId {
  return feature.current_phase;
}
