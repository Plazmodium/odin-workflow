/**
 * Verify Claims Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { buildWatcherQueueNextActions, buildWatcherQueueText } from '../domain/watcher-queue.js';
import type { VerifyClaimsInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleVerifyClaims(
  adapter: WorkflowStateAdapter,
  input: VerifyClaimsInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const claims = await adapter.listClaimVerificationStatus(input.feature_id);
  const claims_needing_review = await adapter.listClaimsNeedingReview(input.feature_id);
  const counts = {
    total: claims.length,
    passed: claims.filter((claim) => claim.final_status === 'PASS').length,
    failed: claims.filter((claim) => claim.final_status === 'FAIL').length,
    needs_review: claims.filter((claim) => claim.final_status === 'NEEDS_REVIEW').length,
    pending: claims.filter((claim) => claim.final_status === 'PENDING').length,
  };
  const next_actions =
    claims_needing_review.length === 0
      ? []
      : [
          `Claim IDs awaiting watcher review: ${claims_needing_review.map((claim) => claim.claim_id).join(', ')}.`,
          ...buildWatcherQueueNextActions(feature.id),
        ];

  const text =
    claims_needing_review.length === 0
      ? `Verified ${counts.total} claim(s) for feature ${feature.id}.`
      : buildWatcherQueueText(
          claims_needing_review,
          feature.id,
          `Verified ${counts.total} claim(s) for feature ${feature.id}; ${claims_needing_review.length} claim(s) still await watcher review.`
        );

  return createTextResult(
    text,
    {
      feature_id: feature.id,
      counts,
      claims,
      claims_needing_review,
      next_actions,
    }
  );
}
