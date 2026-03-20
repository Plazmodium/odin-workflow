/**
 * Record Merge Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RecordMergeInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleRecordMerge(
  adapter: WorkflowStateAdapter,
  input: RecordMergeInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const merge = await adapter.recordMerge(input.feature_id, input.merged_by);

  return createTextResult(
    `Recorded merge for feature ${merge.feature_id}.`,
    { merge }
  );
}
