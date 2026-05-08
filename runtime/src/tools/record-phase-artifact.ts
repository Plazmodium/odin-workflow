/**
 * Record Phase Artifact Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { SkillAdapter } from '../adapters/skills/types.js';
import type { RuntimeConfig } from '../config.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import type { RecordPhaseArtifactInput } from '../schemas.js';
import { createId, createErrorResult, createTextResult } from '../utils.js';
import { assessStrictPhaseAgentPrework } from './phase-agent-prework.js';

export async function handleRecordPhaseArtifact(
  adapter: WorkflowStateAdapter,
  input: RecordPhaseArtifactInput,
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
    output_type: input.output_type,
    content: input.content,
    artifact_path: input.artifact_path ?? null,
    created_by,
    created_at: new Date().toISOString(),
  });

  return createTextResult(
    `Recorded ${artifact.output_type} artifact for feature ${artifact.feature_id}.`,
    { artifact }
  );
}
