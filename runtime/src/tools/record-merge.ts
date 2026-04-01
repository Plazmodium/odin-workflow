/**
 * Record Merge Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import { resolveAutomationDecision } from '../domain/automation-policy.js';
import type { RecordMergeInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleRecordMerge(
  adapter: WorkflowStateAdapter,
  config: RuntimeConfig,
  input: RecordMergeInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const [open_blockers, open_gate_records, open_findings, pending_claims, claim_verification, claims_needing_review] =
    await Promise.all([
      adapter.listOpenBlockers(input.feature_id),
      adapter.listOpenGateRecords(input.feature_id),
      adapter.listOpenFindings(input.feature_id),
      adapter.listPendingClaims(input.feature_id),
      adapter.listClaimVerificationStatus(input.feature_id),
      adapter.listClaimsNeedingReview(input.feature_id),
    ]);

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

  const merge = await adapter.recordMerge(input.feature_id, input.merged_by);

  return createTextResult(
    `Recorded merge for feature ${merge.feature_id}.`,
    { merge, automation }
  );
}
