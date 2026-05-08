/**
 * Get Feature Health Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { SkillAdapter } from '../adapters/skills/types.js';
import type { RuntimeConfig } from '../config.js';
import { resolveAutomationDecision } from '../domain/automation-policy.js';
import { buildDevelopmentEvalContext } from '../domain/development-evals.js';
import { assessPhaseExecutionPolicy } from '../domain/execution-policy.js';
import { deriveFeatureWorkflowHealth } from '../domain/feature-workflow-health.js';
import { assessPhaseExpectedArtifacts } from '../domain/phase-artifacts.js';
import { getPhaseContract } from '../domain/phases.js';
import { assessPromptRealizationPolicy } from '../domain/prompt-realization.js';
import type { GetFeatureHealthInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';
import { buildPhaseContextBundleForFeature } from './prepare-phase-context.js';

export async function handleGetFeatureHealth(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  config: RuntimeConfig,
  input: GetFeatureHealthInput,
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
  ] = await Promise.all([
    adapter.listPhaseArtifacts(input.feature_id),
    adapter.listReviewChecks(input.feature_id),
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
  const execution_assessment = assessPhaseExecutionPolicy(
    feature.current_phase,
    execution_attestations.find((attestation) => attestation.phase === feature.current_phase) ?? null,
    config.attestation,
  );
  const prompt_realization_assessment = assessPromptRealizationPolicy(
    feature.current_phase,
    expected_current_bundle?.execution.phase_prompt_manifest ?? null,
    prompt_realizations.find((attestation) => attestation.phase === feature.current_phase) ?? null,
    config.attestation,
  );
  const artifact_completion = assessPhaseExpectedArtifacts(feature.current_phase, artifacts, config.attestation);
  const development_evals = buildDevelopmentEvalContext(feature, feature.current_phase, artifacts, open_gate_records);
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
  const workflow_health = deriveFeatureWorkflowHealth({
    feature,
    phase_name: current_phase.name,
    open_blockers,
    open_gate_records,
    open_findings,
    pending_claims,
    claim_verification,
    claims_needing_review,
    invocations,
    execution_assessment,
    prompt_realization_assessment,
    artifact_completion,
    development_evals,
    automation,
    latest_feature_eval,
    latest_review_check: review_checks.at(-1) ?? null,
  });

  const primary_detail = workflow_health.blockers[0]?.message ?? workflow_health.warnings[0]?.message ?? workflow_health.next_actions[0] ?? '';
  const text = primary_detail.length === 0
    ? workflow_health.summary
    : `${workflow_health.summary} ${primary_detail}`;

  return createTextResult(text, { ...workflow_health });
}
