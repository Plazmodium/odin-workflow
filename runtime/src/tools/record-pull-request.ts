/**
 * Record Pull Request Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RecordPullRequestInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleRecordPullRequest(
  adapter: WorkflowStateAdapter,
  input: RecordPullRequestInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const pull_request = await adapter.recordPullRequest(input.feature_id, input.pr_url, input.pr_number);

  return createTextResult(
    `Recorded PR #${pull_request.pr_number} for feature ${pull_request.feature_id}.`,
    { pull_request }
  );
}
