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
  const counts = {
    total: results.length,
    passed: results.filter((result) => result.verdict === 'PASS').length,
    failed: results.filter((result) => result.verdict === 'FAIL').length,
    needs_review: results.filter((result) => result.verdict === 'NEEDS_REVIEW').length,
  };

  return createTextResult(
    `Ran policy checks for ${counts.total} claim(s) on feature ${input.feature_id}.`,
    {
      feature_id: input.feature_id,
      counts,
      results,
    }
  );
}
