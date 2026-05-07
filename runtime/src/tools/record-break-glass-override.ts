import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import type { RecordBreakGlassOverrideInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleRecordBreakGlassOverride(
  adapter: WorkflowStateAdapter,
  input: RecordBreakGlassOverrideInput,
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, { feature_id: input.feature_id });
  }

  const actor = resolveWorkflowActorName(input.phase, input.created_by);
  const follow_up = input.follow_up ?? `Resolve break-glass override for phase ${input.phase}: ${input.missing_proof.join(', ')}.`;
  await adapter.recordAuditEvent(input.feature_id, 'BREAK_GLASS_OVERRIDE_RECORDED', actor, {
    phase: input.phase,
    reason: input.reason,
    missing_proof: input.missing_proof,
    follow_up,
  });
  const gate_id = await adapter.recordQualityGate(
    input.feature_id,
    `break_glass_follow_up_phase_${input.phase}`,
    'REJECTED',
    actor,
    follow_up,
    input.phase,
  );

  return createTextResult(`Recorded break-glass override for feature ${input.feature_id} phase ${input.phase}.`, {
    feature_id: input.feature_id,
    phase: input.phase,
    missing_proof: input.missing_proof,
    follow_up_gate_id: gate_id,
    follow_up,
  });
}
