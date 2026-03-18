/**
 * Get Feature Status Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { getNextPhaseId, getPhaseContract } from '../domain/phases.js';
import type { GetFeatureStatusInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleGetFeatureStatus(
  adapter: WorkflowStateAdapter,
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
    open_gates,
    open_findings,
    pending_claims,
    claim_verification,
    latest_feature_eval,
  ] =
    await Promise.all([
      adapter.listPhaseArtifacts(input.feature_id),
      adapter.listReviewChecks(input.feature_id),
      adapter.listLearnings(input.feature_id),
      adapter.listOpenBlockers(input.feature_id),
      adapter.listOpenGates(input.feature_id),
      adapter.listOpenFindings(input.feature_id),
      adapter.listPendingClaims(input.feature_id),
      adapter.listClaimVerificationStatus(input.feature_id),
      adapter.getLatestFeatureEval(input.feature_id),
    ]);

  const current_phase = getPhaseContract(feature.current_phase);
  const next_phase_id = getNextPhaseId(feature.current_phase);
  const next_phase = next_phase_id == null ? null : getPhaseContract(next_phase_id);
  const latest_review_check = review_checks.at(-1) ?? null;

  return createTextResult(
    `Feature ${feature.id} is ${feature.status} in ${current_phase.name}.`,
    {
      feature,
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
        open_findings,
        pending_claims,
        claim_verification_summary: {
          total: claim_verification.length,
          passed: claim_verification.filter((claim) => claim.final_status === 'PASS').length,
          failed: claim_verification.filter((claim) => claim.final_status === 'FAIL').length,
          needs_review: claim_verification.filter((claim) => claim.final_status === 'NEEDS_REVIEW').length,
          pending: claim_verification.filter((claim) => claim.final_status === 'PENDING').length,
        },
      },
      latest_feature_eval,
      latest_review_check,
      claim_verification,
      recent_artifacts: artifacts.slice(-5),
      recent_learnings: learnings.slice(0, 5),
    }
  );
}
