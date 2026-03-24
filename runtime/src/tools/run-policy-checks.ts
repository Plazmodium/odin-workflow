/**
 * Run Policy Checks Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RunPolicyChecksInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleRunPolicyChecks(
  adapter: WorkflowStateAdapter,
  input: RunPolicyChecksInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const results = await adapter.runPolicyChecks(input.feature_id);
  const claims_needing_review = await adapter.listClaimsNeedingReview(input.feature_id);
  const counts = {
    total: results.length,
    passed: results.filter((result) => result.verdict === 'PASS').length,
    failed: results.filter((result) => result.verdict === 'FAIL').length,
    needs_review: results.filter((result) => result.verdict === 'NEEDS_REVIEW').length,
  };
  const next_actions =
    claims_needing_review.length === 0
      ? []
      : [
          'Use odin.get_claims_needing_review to inspect the watcher queue.',
          'Have watcher-agent review each escalated claim and submit verdicts with odin.record_watcher_review.',
          'Re-run odin.verify_claims after watcher reviews are recorded.',
        ];

  return createTextResult(
    claims_needing_review.length === 0
      ? `Ran policy checks for ${counts.total} claim(s) on feature ${input.feature_id}.`
      : `Ran policy checks for ${counts.total} claim(s) on feature ${input.feature_id}; ${claims_needing_review.length} claim(s) now need watcher review.`,
    {
      feature_id: input.feature_id,
      counts,
      results,
      claims_needing_review,
      next_actions,
    }
  );
}
