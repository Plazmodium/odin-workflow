/**
 * Record Eval Run Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { SkillAdapter } from '../adapters/skills/types.js';
import type { RuntimeConfig } from '../config.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import type { RecordEvalRunInput } from '../schemas.js';
import { createErrorResult, createId, createTextResult } from '../utils.js';
import { assessStrictPhaseAgentPrework } from './phase-agent-prework.js';

export async function handleRecordEvalRun(
  adapter: WorkflowStateAdapter,
  input: RecordEvalRunInput,
  skill_adapter?: SkillAdapter,
  config?: RuntimeConfig,
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const created_by = resolveWorkflowActorName(input.phase, input.created_by);
  if (skill_adapter != null && config != null) {
    const prework_error = await assessStrictPhaseAgentPrework(
      adapter,
      skill_adapter,
      config,
      feature,
      input.phase,
      created_by,
      'record phase artifact',
    );
    if (prework_error != null) {
      return prework_error;
    }
  }

  const artifact = await adapter.recordPhaseArtifact({
    id: createId('artifact'),
    feature_id: input.feature_id,
    phase: input.phase,
    output_type: 'eval_run',
    content: {
      status: input.status,
      cases_run: input.cases_run,
      important_failures: input.important_failures,
      manual_review_notes: input.manual_review_notes,
      transcript_review_observations: input.transcript_review_observations,
      follow_up: input.follow_up,
      environment_summary: input.environment_summary,
    },
    created_by,
    created_at: new Date().toISOString(),
  });

  return createTextResult(`Recorded eval_run for feature ${input.feature_id}.`, {
    artifact,
    eval_run: {
      status: input.status,
      phase: input.phase,
      cases_run: input.cases_run.length,
      important_failures: input.important_failures.length,
    },
  });
}
