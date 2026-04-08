/**
 * Get Claims Needing Review Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { buildWatcherQueueText } from '../domain/watcher-queue.js';
import type { GetClaimsNeedingReviewInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleGetClaimsNeedingReview(
  adapter: WorkflowStateAdapter,
  input: GetClaimsNeedingReviewInput
) {
  if (input.feature_id != null) {
    const feature = await adapter.getFeature(input.feature_id);
    if (feature == null) {
      return createErrorResult(`Feature ${input.feature_id} was not found.`, {
        feature_id: input.feature_id,
      });
    }
  }

  const claims = await adapter.listClaimsNeedingReview(input.feature_id);

  const text =
    claims.length === 0
      ? `No claims need watcher review${input.feature_id == null ? '' : ` for feature ${input.feature_id}`}.`
      : buildWatcherQueueText(
          claims,
          input.feature_id ?? null,
          `Found ${claims.length} claim(s) needing watcher review${input.feature_id == null ? '' : ` for feature ${input.feature_id}`}.`
        );

  return createTextResult(
    text,
    {
      feature_id: input.feature_id ?? null,
      claims,
    }
  );
}
