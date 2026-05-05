/**
 * Get Feature Status Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { SkillAdapter } from '../adapters/skills/types.js';
import type { RuntimeConfig } from '../config.js';
import { resolveAutomationDecision } from '../domain/automation-policy.js';
import { deriveAutonomyFeatureState } from '../domain/autonomous-pickup.js';
import { buildDevelopmentEvalContext } from '../domain/development-evals.js';
import { assessPhaseExecutionPolicy, summarizePhaseExecutionStatus } from '../domain/execution-policy.js';
import { assessPhaseExpectedArtifacts } from '../domain/phase-artifacts.js';
import { getNextPhaseId, getPhaseContract } from '../domain/phases.js';
import { assessPromptRealizationPolicy, buildPromptRealizationStatusRow, PROMPT_REALIZATION_AUDIT_PHASES, summarizePromptRealizationStatus } from '../domain/prompt-realization.js';
import { formatOpenGateSummary } from '../domain/quality-gates.js';
import type { GetFeatureStatusInput } from '../schemas.js';
import type { AgentInvocationRecord, PhaseId } from '../types.js';
import { createErrorResult, createTextResult } from '../utils.js';
import { buildPhaseContextBundleForFeature } from './prepare-phase-context.js';

const EXPECTED_RELEASE_COVERAGE: Array<{ phase: PhaseId; agent_name: string }> = [
  { phase: '1', agent_name: 'product-agent' },
  { phase: '2', agent_name: 'discovery-agent' },
  { phase: '3', agent_name: 'architect-agent' },
  { phase: '4', agent_name: 'guardian-agent' },
  { phase: '5', agent_name: 'builder-agent' },
  { phase: '6', agent_name: 'reviewer-agent' },
  { phase: '7', agent_name: 'integrator-agent' },
  { phase: '8', agent_name: 'documenter-agent' },
  { phase: '9', agent_name: 'release-agent' },
];

function buildInvocationCoverage(
  invocations: AgentInvocationRecord[],
): {
  completed: Array<{ phase: PhaseId; agent_name: string; started_at: string; ended_at: string; duration_ms: number }>;
  pre_release_complete: boolean;
  pre_release_missing: Array<{ phase: PhaseId; agent_name: string }>;
  pre_completion_complete: boolean;
  pre_completion_missing: Array<{ phase: PhaseId; agent_name: string }>;
} {
  const completed = invocations.filter(
    (invocation): invocation is AgentInvocationRecord & { ended_at: string; duration_ms: number } =>
      invocation.ended_at != null && invocation.duration_ms != null
  );
  const completed_phases = new Set(completed.map((invocation) => invocation.phase));
  const pre_release_expected = EXPECTED_RELEASE_COVERAGE.filter((entry) => entry.phase !== '9');
  const pre_release_missing = pre_release_expected.filter((entry) => !completed_phases.has(entry.phase));
  const pre_completion_missing = EXPECTED_RELEASE_COVERAGE.filter((entry) => !completed_phases.has(entry.phase));

  return {
    completed: completed.map((invocation) => ({
      phase: invocation.phase,
      agent_name: invocation.agent_name,
      started_at: invocation.started_at,
      ended_at: invocation.ended_at,
      duration_ms: invocation.duration_ms,
    })),
    pre_release_complete: pre_release_missing.length === 0,
    pre_release_missing,
    pre_completion_complete: pre_completion_missing.length === 0,
    pre_completion_missing,
  };
}

function deriveReleaseStage(feature: { current_phase: PhaseId; pr_url?: string; merged_at?: string; completed_at?: string; release_handoff_at?: string; release_closeout_at?: string }) {
  if (feature.release_closeout_at != null || feature.completed_at != null || feature.current_phase === '10') {
    return 'closed' as const;
  }

  if (feature.current_phase !== '9') {
    return 'not_in_release' as const;
  }

  if (feature.merged_at != null) {
    return 'merged_closeout_ready' as const;
  }

  if (feature.release_handoff_at != null || feature.pr_url != null) {
    return 'handoff_created_waiting_merge' as const;
  }

  return 'handoff_ready' as const;
}

export async function handleGetFeatureStatus(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  config: RuntimeConfig,
  input: GetFeatureStatusInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const [
    artifacts,
    review_checks,
    learnings,
    open_blockers,
    open_gate_records,
    open_findings,
    pending_claims,
    claim_verification,
    claims_needing_review,
    invocations,
    execution_attestations,
    prompt_realizations,
    latest_feature_eval,
    expected_current_bundle,
  ] =
    await Promise.all([
      adapter.listPhaseArtifacts(input.feature_id),
      adapter.listReviewChecks(input.feature_id),
      adapter.listLearnings(input.feature_id),
      adapter.listOpenBlockers(input.feature_id),
      adapter.listOpenGateRecords(input.feature_id),
      adapter.listOpenFindings(input.feature_id),
      adapter.listPendingClaims(input.feature_id),
      adapter.listClaimVerificationStatus(input.feature_id),
      adapter.listClaimsNeedingReview(input.feature_id),
      adapter.listAgentInvocations(input.feature_id),
      adapter.listPhaseExecutionAttestations(input.feature_id),
      adapter.listPhasePromptRealizations(input.feature_id),
      adapter.getLatestFeatureEval(input.feature_id),
      feature.current_phase === '10'
        ? Promise.resolve(null)
        : buildPhaseContextBundleForFeature(feature, adapter, skill_adapter, config, {
            feature_id: input.feature_id,
            phase: feature.current_phase,
            include_artifacts: true,
            include_skills: true,
            include_learnings: true,
          }, { open_invocation: false }),
    ]);

  const current_phase = getPhaseContract(feature.current_phase);
  const next_phase_id = getNextPhaseId(feature.current_phase);
  const next_phase = next_phase_id == null ? null : getPhaseContract(next_phase_id);
  const latest_review_check = review_checks.at(-1) ?? null;
  const open_gates = open_gate_records.map(formatOpenGateSummary);
  const development_evals = buildDevelopmentEvalContext(feature, feature.current_phase, artifacts, open_gate_records);
  const artifact_completion = assessPhaseExpectedArtifacts(feature.current_phase, artifacts, config.attestation);
  const invocation_coverage = buildInvocationCoverage(invocations);
  const execution_status = summarizePhaseExecutionStatus(execution_attestations, config.attestation);
  const current_phase_execution = assessPhaseExecutionPolicy(
    feature.current_phase,
    execution_attestations.find((attestation) => attestation.phase === feature.current_phase) ?? null,
    config.attestation,
  );
  const prompt_realization_rows = PROMPT_REALIZATION_AUDIT_PHASES.map((phase) =>
    buildPromptRealizationStatusRow(
      phase,
      phase === feature.current_phase ? expected_current_bundle?.execution.phase_prompt_manifest ?? null : null,
      prompt_realizations.find((attestation) => attestation.phase === phase) ?? null,
      config.attestation,
    )
  );
  const prompt_realization_status = summarizePromptRealizationStatus(prompt_realization_rows);
  const current_phase_prompt_realization = assessPromptRealizationPolicy(
    feature.current_phase,
    expected_current_bundle?.execution.phase_prompt_manifest ?? null,
    prompt_realizations.find((attestation) => attestation.phase === feature.current_phase) ?? null,
    config.attestation,
  );
  const automation = resolveAutomationDecision({
    config,
    feature,
    open_blockers,
    open_gate_records,
    open_findings,
    pending_claims,
    claim_verification,
    claims_needing_review_count: claims_needing_review.length,
  });
  const autonomy = deriveAutonomyFeatureState({
    feature,
    automation,
    open_blockers,
    open_gate_records,
    open_findings,
    pending_claims,
    claims_needing_review_count: claims_needing_review.length,
    has_open_invocation: invocations.some((invocation) => invocation.ended_at == null),
  });

  return createTextResult(
    `Feature ${feature.id} is ${feature.status} in ${current_phase.name}.`,
    {
      feature,
      automation,
      autonomy,
      release: {
        pr_url: feature.pr_url ?? null,
        pr_number: feature.pr_number ?? null,
        stage: deriveReleaseStage(feature),
        handoff_created_at: feature.release_handoff_at ?? null,
        handoff_created_by: feature.release_handoff_by ?? null,
        handoff_summary: feature.release_handoff_summary ?? null,
        merged_at: feature.merged_at ?? null,
        closeout_created_at: feature.release_closeout_at ?? null,
        closeout_created_by: feature.release_closeout_by ?? null,
        closeout_summary: feature.release_closeout_summary ?? null,
        completed_at: feature.completed_at ?? null,
      },
      current_phase,
      next_phase,
      counts: {
        artifacts: artifacts.length,
        review_checks: review_checks.length,
        learnings: learnings.length,
        open_blockers: open_blockers.length,
        open_gates: open_gates.length,
        open_findings: open_findings.length,
        pending_claims: pending_claims.length,
      },
      workflow: {
        open_blockers,
        open_gates,
        open_gate_records,
        open_findings,
        pending_claims,
        claim_verification_summary: {
          total: claim_verification.length,
          passed: claim_verification.filter((claim) => claim.final_status === 'PASS').length,
          failed: claim_verification.filter((claim) => claim.final_status === 'FAIL').length,
          needs_review: claim_verification.filter((claim) => claim.final_status === 'NEEDS_REVIEW').length,
          pending: claim_verification.filter((claim) => claim.final_status === 'PENDING').length,
        },
        invocation_coverage,
      },
      phase_execution: {
        attestation_mode: config.attestation?.mode ?? 'advisory',
        current_phase: current_phase_execution,
        summary: execution_status,
      },
      prompt_realization: {
        attestation_mode: config.attestation?.mode ?? 'advisory',
        current_phase: current_phase_prompt_realization,
        summary: prompt_realization_status,
      },
      artifact_completion,
      development_evals,
      latest_feature_eval,
      latest_review_check,
      claim_verification,
      recent_artifacts: artifacts.slice(-5),
      recent_learnings: learnings.slice(0, 5),
    }
  );
}
