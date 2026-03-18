/**
 * Get Next Phase Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { getNextPhaseId, getPhaseContract } from '../domain/phases.js';
import type { GetNextPhaseInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleGetNextPhase(
  adapter: WorkflowStateAdapter,
  input: GetNextPhaseInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const current_phase = getPhaseContract(feature.current_phase);
  const next_phase_id = getNextPhaseId(feature.current_phase);
  const next_phase = next_phase_id == null ? null : getPhaseContract(next_phase_id);

  return createTextResult(
    next_phase == null
      ? `Feature ${feature.id} is at the terminal phase ${current_phase.name}.`
      : `Feature ${feature.id} is at ${current_phase.name}; next phase is ${next_phase.name}.`,
    {
      feature_id: feature.id,
      current_phase: current_phase,
      next_phase,
      blocked: feature.status === 'BLOCKED',
    }
  );
}
