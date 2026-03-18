/**
 * Run Review Checks Tool
 * Version: 0.1.0
 */

import type { ReviewAdapter } from '../adapters/review/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RunReviewChecksInput } from '../schemas.js';
import { createErrorResult, createId, createTextResult } from '../utils.js';

export async function handleRunReviewChecks(
  adapter: WorkflowStateAdapter,
  review_adapter: ReviewAdapter,
  input: RunReviewChecksInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const execution = await review_adapter.runChecks({
    feature_id: input.feature_id,
    tool: input.tool,
    changed_files: input.changed_files,
  });

  const review_check = await adapter.recordReviewCheck({
    id: createId('review'),
    feature_id: input.feature_id,
    phase: input.phase,
    tool: execution.tool,
    status: execution.status,
    summary: execution.summary,
    changed_files: execution.changed_files,
    initiated_by: input.initiated_by,
    created_at: new Date().toISOString(),
  });

  // GAP-4: Persist individual security findings for dashboard visibility
  let findings_recorded = 0;
  if (execution.findings.length > 0) {
    try {
      findings_recorded = await adapter.recordSecurityFindings(
        input.feature_id,
        input.phase,
        execution.findings,
        input.tool
      );
    } catch {
      console.error(`[Odin Runtime] Failed to record security findings for ${input.feature_id}`);
    }
  }

  return createTextResult(
    `Review checks completed for feature ${review_check.feature_id} with status ${review_check.status}.`,
    {
      review_check,
      findings: execution.findings,
      findings_recorded,
    }
  );
}
