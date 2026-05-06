/**
 * Submit Claim Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import { getPhaseAgentInstructions, isWatchedPhase } from '../domain/phases.js';
import type { SubmitClaimInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

function mergeEvidence(input: SubmitClaimInput): Record<string, unknown> {
  if (input.evidence == null) {
    return input.evidence_refs;
  }

  const structured = Object.fromEntries(
    Object.entries(input.evidence).filter(([, value]) => Array.isArray(value) && value.length > 0)
  );

  return {
    ...input.evidence_refs,
    ...structured,
  };
}

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

  if (!isWatchedPhase(input.phase)) {
    return createErrorResult(
      `Claims can only be submitted from watched phases (Builder, Integrator, Release). Phase ${input.phase} is not watched.`,
      {
        feature_id: input.feature_id,
        phase: input.phase,
        allowed_phases: ['5', '7', '9'],
      }
    );
  }

  if (feature.current_phase !== input.phase) {
    return createErrorResult(
      `Feature ${input.feature_id} is currently in phase ${feature.current_phase}, not ${input.phase}. Claims must be submitted from the feature's active watched phase.`,
      {
        feature_id: input.feature_id,
        expected_phase: feature.current_phase,
        provided_phase: input.phase,
      }
    );
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
    evidence_refs: mergeEvidence(input),
    risk_level: input.risk_level,
  });

  return createTextResult(
    `Submitted ${claim.claim_type} claim for feature ${claim.feature_id}.`,
    { claim }
  );
}
