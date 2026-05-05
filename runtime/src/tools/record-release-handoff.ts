/**
 * Record Release Handoff Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import type { RecordReleaseHandoffInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleRecordReleaseHandoff(
  adapter: WorkflowStateAdapter,
  input: RecordReleaseHandoffInput,
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  if (feature.current_phase !== '9') {
    return createErrorResult(
      `Feature ${input.feature_id} is currently in phase ${feature.current_phase}, not Release.`,
      {
        feature_id: input.feature_id,
        current_phase: feature.current_phase,
      },
    );
  }

  if (feature.pr_url == null || feature.pr_number == null) {
    return createErrorResult(
      `Feature ${input.feature_id} cannot record release handoff until a pull request is recorded.`,
      {
        feature_id: input.feature_id,
      },
    );
  }

  const actor = resolveWorkflowActorName('9', input.created_by);
  const actor_invocation = await adapter.findOpenAgentInvocation(input.feature_id, '9', actor);
  const open_phase_invocations = (await adapter.listAgentInvocations(input.feature_id)).filter(
    (invocation) => invocation.phase === '9' && invocation.ended_at == null,
  );
  const invocation_ids = new Set<string>([
    ...(actor_invocation == null ? [] : [actor_invocation.id]),
    ...open_phase_invocations.map((invocation) => invocation.id),
  ]);

  for (const invocation_id of invocation_ids) {
    await adapter.completeAgentInvocation(invocation_id);
  }

  const handoff = await adapter.recordReleaseHandoff(input.feature_id, input.summary, actor);

  await adapter.recordAuditEvent(input.feature_id, 'RELEASE_HANDOFF_RECORDED', actor, {
    summary: input.summary,
    pr_url: feature.pr_url,
    pr_number: feature.pr_number,
  });

  const refreshed = await adapter.getFeature(input.feature_id);

  return createTextResult(
    `Recorded release handoff for feature ${input.feature_id}.`,
    {
      feature: refreshed,
      handoff: {
        ...handoff,
        summary: input.summary,
        pr_url: feature.pr_url,
        pr_number: feature.pr_number,
        closed_invocations: Array.from(invocation_ids),
      },
    },
  );
}
