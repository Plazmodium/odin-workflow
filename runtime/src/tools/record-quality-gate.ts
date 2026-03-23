/**
 * Record Quality Gate Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RecordQualityGateInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleRecordQualityGate(
  adapter: WorkflowStateAdapter,
  input: RecordQualityGateInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const gate_id = await adapter.recordQualityGate(
    input.feature_id,
    input.gate_name,
    input.status,
    input.approver,
    input.notes,
    input.phase
  );

  return createTextResult(
    `Recorded ${input.status.toLowerCase()} quality gate ${input.gate_name} for feature ${input.feature_id}.`,
    {
      gate: {
        id: gate_id,
        feature_id: input.feature_id,
        gate_name: input.gate_name,
        phase: input.phase,
        status: input.status,
        approver: input.approver,
        notes: input.notes,
      },
    }
  );
}
