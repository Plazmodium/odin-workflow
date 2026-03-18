/**
 * Verify Claims Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
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
  const counts = {
    total: claims.length,
    passed: claims.filter((claim) => claim.final_status === 'PASS').length,
    failed: claims.filter((claim) => claim.final_status === 'FAIL').length,
    needs_review: claims.filter((claim) => claim.final_status === 'NEEDS_REVIEW').length,
    pending: claims.filter((claim) => claim.final_status === 'PENDING').length,
  };

  return createTextResult(
    `Verified ${counts.total} claim(s) for feature ${feature.id}.`,
    {
      feature_id: feature.id,
      counts,
      claims,
    }
  );
}
