/**
 * Record Eval Plan Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import type { RecordEvalPlanInput } from '../schemas.js';
import { createErrorResult, createId, createTextResult } from '../utils.js';

export async function handleRecordEvalPlan(
  adapter: WorkflowStateAdapter,
  input: RecordEvalPlanInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const created_by = resolveWorkflowActorName('3', input.created_by);
  const artifact = await adapter.recordPhaseArtifact({
    id: createId('artifact'),
    feature_id: input.feature_id,
    phase: '3',
    output_type: 'eval_plan',
    content: {
      scope: input.scope,
      success_criteria: input.success_criteria,
      non_goals: input.non_goals,
      capability_evals: input.capability_evals,
      regression_evals: input.regression_evals,
      transcript_review_plan: input.transcript_review_plan,
      solvability_note: input.solvability_note,
    },
    created_by,
    created_at: new Date().toISOString(),
  });

  return createTextResult(`Recorded eval_plan for feature ${input.feature_id}.`, {
    artifact,
    counts: {
      capability_evals: input.capability_evals.length,
      regression_evals: input.regression_evals.length,
    },
  });
}
