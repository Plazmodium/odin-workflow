import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import { getPhaseAgentInstructions } from '../domain/phases.js';
import type { RecordPhaseSkillsAppliedInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleRecordPhaseSkillsApplied(
  adapter: WorkflowStateAdapter,
  input: RecordPhaseSkillsAppliedInput,
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, { feature_id: input.feature_id });
  }

  const actor = resolveWorkflowActorName(input.phase, input.agent_name ?? getPhaseAgentInstructions(input.phase).name);
  await adapter.recordAuditEvent(input.feature_id, 'PHASE_SKILLS_APPLIED_RECORDED', actor, {
    phase: input.phase,
    skills_applied: input.skills_applied,
    fallback_used: input.fallback_used,
    no_applicable_skill: input.no_applicable_skill,
    notes: input.notes ?? null,
  });

  return createTextResult(`Recorded skills_applied for feature ${input.feature_id} phase ${input.phase}.`, {
    feature_id: input.feature_id,
    phase: input.phase,
    skills_applied: input.skills_applied,
    fallback_used: input.fallback_used,
    no_applicable_skill: input.no_applicable_skill,
  });
}
