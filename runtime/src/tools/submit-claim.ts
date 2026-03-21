/**
 * Submit Claim Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import { getPhaseAgentInstructions } from '../domain/phases.js';
import type { SubmitClaimInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleSubmitClaim(
  adapter: WorkflowStateAdapter,
  input: SubmitClaimInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const agent_name = resolveWorkflowActorName(
    input.phase,
    input.agent_name ?? getPhaseAgentInstructions(input.phase).name
  );
  const invocation =
    input.invocation_id == null
      ? await adapter.findOpenAgentInvocation(input.feature_id, input.phase, agent_name)
      : null;

  const claim = await adapter.submitClaim({
    feature_id: input.feature_id,
    phase: input.phase,
    agent_name,
    invocation_id: input.invocation_id ?? invocation?.id ?? null,
    claim_type: input.claim_type,
    claim_description: input.description,
    evidence_refs: input.evidence_refs,
    risk_level: input.risk_level,
  });

  return createTextResult(
    `Submitted ${claim.claim_type} claim for feature ${claim.feature_id}.`,
    { claim }
  );
}
