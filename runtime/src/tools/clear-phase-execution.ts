import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { ClearPhaseExecutionInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleClearPhaseExecution(
  adapter: WorkflowStateAdapter,
  input: ClearPhaseExecutionInput,
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  if (feature.current_phase !== input.phase) {
    return createErrorResult(
      `Feature ${input.feature_id} is currently in phase ${feature.current_phase}, not ${input.phase}.`,
      {
        feature_id: input.feature_id,
        expected_phase: feature.current_phase,
        provided_phase: input.phase,
      },
    );
  }

  await adapter.clearPhaseExecutionAttestation(input.feature_id, input.phase);
  return createTextResult(
    `Cleared execution attestation for feature ${input.feature_id} phase ${input.phase}.`,
    {
      feature_id: input.feature_id,
      phase: input.phase,
    },
  );
}
