import type { AutomationDecision } from '../types.js';
import type { PhaseArtifactCompletionAssessment } from './phase-artifacts.js';
import type { PhaseExecutionPolicyAssessment } from './execution-policy.js';
import type { PromptRealizationAssessment } from './prompt-realization.js';
import { buildWatcherQueueNextActions } from './watcher-queue.js';
import type {
  AgentInvocationRecord,
  ClaimVerificationSummary,
  FeatureEvalSummary,
  FeatureRecord,
  PhaseContextBundle,
  PhaseId,
  QualityGateRecord,
  ReviewCheckRecord,
  WatcherQueueClaim,
} from '../types.js';

export type FeatureWorkflowHealthStatus =
  | 'ready'
  | 'running'
  | 'blocked'
  | 'waiting_on_review'
  | 'waiting_on_watchers'
  | 'waiting_on_human'
  | 'needs_attention'
  | 'complete';

export type FeatureWorkflowHealthBlockerKind =
  | 'blocker'
  | 'gate'
  | 'finding'
  | 'claim'
  | 'attestation'
  | 'artifact'
  | 'eval'
  | 'release';

export interface FeatureWorkflowHealthBlocker {
  kind: FeatureWorkflowHealthBlockerKind;
  message: string;
  recovery: string | null;
}

export interface FeatureWorkflowHealthWarning {
  kind: string;
  message: string;
}

export interface FeatureWorkflowHealth {
  feature_id: string;
  feature_name: string;
  status: FeatureWorkflowHealthStatus;
  summary: string;
  current_focus: {
    phase: PhaseId;
    phase_name: string;
  };
  blockers: FeatureWorkflowHealthBlocker[];
  warnings: FeatureWorkflowHealthWarning[];
  next_actions: string[];
}

export interface DeriveFeatureWorkflowHealthInput {
  feature: FeatureRecord;
  phase_name: string;
  open_blockers: string[];
  open_gate_records: QualityGateRecord[];
  open_findings: string[];
  pending_claims: string[];
  claim_verification: ClaimVerificationSummary[];
  claims_needing_review: WatcherQueueClaim[];
  invocations: AgentInvocationRecord[];
  execution_assessment: PhaseExecutionPolicyAssessment;
  prompt_realization_assessment: PromptRealizationAssessment;
  artifact_completion: PhaseArtifactCompletionAssessment;
  development_evals: PhaseContextBundle['development_evals'];
  automation: AutomationDecision;
  latest_feature_eval: FeatureEvalSummary | null;
  latest_review_check: ReviewCheckRecord | null;
}

function plural(count: number, singular: string, pluralWord: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function openInvocation(input: DeriveFeatureWorkflowHealthInput): AgentInvocationRecord | null {
  return input.invocations.find((invocation) => invocation.ended_at == null) ?? null;
}

function claimAttentionCount(input: DeriveFeatureWorkflowHealthInput): number {
  const claim_ids = new Set<string>();
  for (const claim of input.claims_needing_review) {
    claim_ids.add(claim.claim_id);
  }
  for (const claim of input.claim_verification.filter((claim) => claim.final_status !== 'PASS')) {
    claim_ids.add(claim.claim_id);
  }

  return input.pending_claims.length + claim_ids.size;
}

function buildBaseWarnings(input: DeriveFeatureWorkflowHealthInput): FeatureWorkflowHealthWarning[] {
  const warnings: FeatureWorkflowHealthWarning[] = [];

  if (input.execution_assessment.warning != null) {
    warnings.push({ kind: 'attestation', message: input.execution_assessment.warning });
  }

  if (input.prompt_realization_assessment.warning != null) {
    warnings.push({ kind: 'attestation', message: input.prompt_realization_assessment.warning });
  }

  if (input.artifact_completion.warning != null) {
    warnings.push({ kind: 'artifact', message: input.artifact_completion.warning });
  }

  if (input.latest_review_check?.status === 'failed') {
    warnings.push({ kind: 'review', message: `Latest review check failed: ${input.latest_review_check.summary}` });
  }

  if (input.latest_feature_eval?.health_status === 'CONCERNING' || input.latest_feature_eval?.health_status === 'CRITICAL') {
    warnings.push({
      kind: 'eval',
      message: `Latest post-hoc EVALS health is ${input.latest_feature_eval.health_status}.`,
    });
  }

  return warnings;
}

function buildDevelopmentEvalBlockers(input: DeriveFeatureWorkflowHealthInput): FeatureWorkflowHealthBlocker[] {
  return input.development_evals.expected_artifacts
    .filter((expected) => input.development_evals.latest_plan?.output_type !== expected && input.development_evals.latest_run?.output_type !== expected)
    .map((expected) => ({
      kind: 'eval' as const,
      message: `Current phase expects a ${expected} development eval artifact.`,
      recovery: expected === 'eval_plan'
        ? 'Record the eval plan with odin.record_eval_plan, then rerun odin.get_feature_health.'
        : 'Record the eval run with odin.record_eval_run, then rerun odin.get_feature_health.',
    }));
}

function buildReadyNextAction(input: DeriveFeatureWorkflowHealthInput): string {
  if (input.feature.current_phase === '9') {
    if (input.feature.merged_at != null) {
      return 'Record Release closeout and complete the feature.';
    }

    if (input.feature.pr_url != null) {
      return 'Wait for human merge, then record it with odin.record_merge.';
    }

    if (input.automation.capabilities.can_open_pr) {
      return 'Create and record the pull request, then archive the release artifacts.';
    }
  }

  return `Continue ${input.phase_name}: prepare phase context, complete required work, record artifacts, then complete the phase.`;
}

function releaseNeedsHuman(input: DeriveFeatureWorkflowHealthInput): FeatureWorkflowHealthBlocker | null {
  if (input.feature.current_phase !== '9') {
    return null;
  }

  if (input.feature.merged_at != null) {
    return null;
  }

  if (input.feature.pr_url != null) {
    return {
      kind: 'release',
      message: 'Pull request is recorded and waiting for a human merge.',
      recovery: 'After the human merge, record it with odin.record_merge, then rerun odin.get_feature_health.',
    };
  }

  if (!input.automation.capabilities.can_open_pr) {
    return {
      kind: 'release',
      message: input.automation.blocking_reasons[0] ?? 'Release is waiting for human PR handoff.',
      recovery: 'Resolve the automation blocker or create the PR manually and record it with odin.record_pull_request.',
    };
  }

  return null;
}

export function deriveFeatureWorkflowHealth(input: DeriveFeatureWorkflowHealthInput): FeatureWorkflowHealth {
  const warnings = buildBaseWarnings(input);
  const current_focus = {
    phase: input.feature.current_phase,
    phase_name: input.phase_name,
  };

  if (input.feature.status === 'COMPLETED' || input.feature.completed_at != null || input.feature.current_phase === '10') {
    return {
      feature_id: input.feature.id,
      feature_name: input.feature.name,
      status: 'complete',
      summary: `Feature ${input.feature.id} is complete.`,
      current_focus,
      blockers: [],
      warnings,
      next_actions: ['No workflow action is required.'],
    };
  }

  const invocation = openInvocation(input);
  if (invocation != null) {
    return {
      feature_id: input.feature.id,
      feature_name: input.feature.name,
      status: 'running',
      summary: `Feature ${input.feature.id} is running in ${input.phase_name}.`,
      current_focus,
      blockers: [],
      warnings,
      next_actions: [`Wait for invocation ${invocation.id} to finish, or complete it before taking the next workflow action.`],
    };
  }

  if (input.feature.status === 'BLOCKED' || input.open_blockers.length > 0) {
    const blockers = input.open_blockers.length === 0
      ? [{ kind: 'blocker' as const, message: 'Feature status is BLOCKED.', recovery: 'Record the blocking reason in the workflow, resolve it, then rerun odin.get_feature_health.' }]
      : input.open_blockers.map((message) => ({
          kind: 'blocker' as const,
          message,
          recovery: 'Resolve this blocker, then rerun odin.get_feature_health.',
        }));

    return {
      feature_id: input.feature.id,
      feature_name: input.feature.name,
      status: 'blocked',
      summary: `Feature ${input.feature.id} is blocked in ${input.phase_name}.`,
      current_focus,
      blockers,
      warnings,
      next_actions: ['Resolve the open blocker, then rerun odin.get_feature_health before continuing.'],
    };
  }

  const attestation_blockers: FeatureWorkflowHealthBlocker[] = [
    ...(input.execution_assessment.error == null
      ? []
      : [{
          kind: 'attestation' as const,
          message: input.execution_assessment.error,
          recovery: 'Run the canonical Odin phase agent in a distinct worker session, record odin.register_phase_execution and odin.register_phase_realization, then rerun odin.get_feature_health.',
        }]),
    ...(input.prompt_realization_assessment.error == null
      ? []
      : [{
          kind: 'attestation' as const,
          message: input.prompt_realization_assessment.error,
          recovery: 'Build the worker prompt from odin.prepare_phase_context, invoke the canonical phase agent or spawned subagent, record odin.register_phase_realization, then rerun odin.get_feature_health.',
        }]),
  ];

  if (attestation_blockers.length > 0) {
    return {
      feature_id: input.feature.id,
      feature_name: input.feature.name,
      status: 'needs_attention',
      summary: `Feature ${input.feature.id} needs attestation attention in ${input.phase_name}.`,
      current_focus,
      blockers: attestation_blockers,
      warnings,
      next_actions: attestation_blockers.map((blocker) => blocker.recovery).filter((recovery): recovery is string => recovery != null),
    };
  }

  const artifact_blockers: FeatureWorkflowHealthBlocker[] = input.artifact_completion.error == null
    ? []
    : [{
        kind: 'artifact',
        message: input.artifact_completion.error,
        recovery: 'Record the missing current-phase artifact with odin.record_phase_artifact, then rerun odin.get_feature_health.',
      }];
  const eval_blockers = buildDevelopmentEvalBlockers(input);

  if (artifact_blockers.length > 0 || eval_blockers.length > 0) {
    const blockers = [...artifact_blockers, ...eval_blockers];
    return {
      feature_id: input.feature.id,
      feature_name: input.feature.name,
      status: 'needs_attention',
      summary: `Feature ${input.feature.id} needs required artifact attention in ${input.phase_name}.`,
      current_focus,
      blockers,
      warnings,
      next_actions: blockers.map((blocker) => blocker.recovery).filter((recovery): recovery is string => recovery != null),
    };
  }

  const claim_count = claimAttentionCount(input);
  if (claim_count > 0) {
    const claim_blockers: FeatureWorkflowHealthBlocker[] = [
      ...input.claims_needing_review.map((claim) => ({
        kind: 'claim' as const,
        message: `${claim.claim_id} needs watcher review: ${claim.claim_type} by ${claim.agent_name}.`,
        recovery: 'Have watcher-agent review this claim and record the verdict with odin.record_watcher_review.',
      })),
      ...input.pending_claims.map((claim) => ({
        kind: 'claim' as const,
        message: claim,
        recovery: 'Run odin.verify_claims to resolve policy status, then handle any watcher queue entries.',
      })),
      ...input.claim_verification
        .filter((claim) => claim.final_status !== 'PASS')
        .map((claim) => ({
          kind: 'claim' as const,
          message: `${claim.claim_id} verification is ${claim.final_status}.`,
          recovery: claim.final_status === 'FAIL'
            ? 'Fix the failing claim evidence or implementation, rerun policy checks, then rerun odin.get_feature_health.'
            : 'Resolve claim policy/watcher review, then rerun odin.get_feature_health.',
        })),
    ];

    return {
      feature_id: input.feature.id,
      feature_name: input.feature.name,
      status: 'waiting_on_watchers',
      summary: `Feature ${input.feature.id} is waiting on ${plural(claim_count, 'claim')} in ${input.phase_name}.`,
      current_focus,
      blockers: claim_blockers,
      warnings,
      next_actions: buildWatcherQueueNextActions(input.feature.id),
    };
  }

  if (input.open_gate_records.length > 0 || input.open_findings.length > 0) {
    const blockers: FeatureWorkflowHealthBlocker[] = [
      ...input.open_gate_records.map((gate) => ({
        kind: 'gate' as const,
        message: `${gate.gate_name} is ${gate.status} in phase ${gate.phase}.`,
        recovery: 'Resolve this quality gate, then rerun odin.get_feature_health.',
      })),
      ...input.open_findings.map((finding) => ({
        kind: 'finding' as const,
        message: finding,
        recovery: 'Fix or disposition this review finding, rerun review checks, then rerun odin.get_feature_health.',
      })),
    ];

    return {
      feature_id: input.feature.id,
      feature_name: input.feature.name,
      status: 'waiting_on_review',
      summary: `Feature ${input.feature.id} is waiting on review resolution in ${input.phase_name}.`,
      current_focus,
      blockers,
      warnings,
      next_actions: ['Resolve open gates and findings, then rerun odin.get_feature_health before continuing.'],
    };
  }

  const release_blocker = releaseNeedsHuman(input);
  if (release_blocker != null) {
    return {
      feature_id: input.feature.id,
      feature_name: input.feature.name,
      status: 'waiting_on_human',
      summary: `Feature ${input.feature.id} is waiting on human release action in ${input.phase_name}.`,
      current_focus,
      blockers: [release_blocker],
      warnings,
      next_actions: [release_blocker.recovery].filter((recovery): recovery is string => recovery != null),
    };
  }

  return {
    feature_id: input.feature.id,
    feature_name: input.feature.name,
    status: 'ready',
    summary: `Feature ${input.feature.id} is ready in ${input.phase_name}.`,
    current_focus,
    blockers: [],
    warnings,
    next_actions: [buildReadyNextAction(input)],
  };
}
