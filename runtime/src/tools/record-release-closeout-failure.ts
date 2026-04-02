/**
 * Record Release Closeout Failure Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import type { RecordReleaseCloseoutFailureInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleRecordReleaseCloseoutFailure(
  adapter: WorkflowStateAdapter,
  input: RecordReleaseCloseoutFailureInput,
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const actor = resolveWorkflowActorName('9', input.created_by);
  const open_phase_invocations = (await adapter.listAgentInvocations(input.feature_id)).filter(
    (invocation) => invocation.phase === '9' && invocation.ended_at == null,
  );

  for (const invocation of open_phase_invocations) {
    await adapter.completeAgentInvocation(invocation.id);
  }

  await adapter.recordAuditEvent(input.feature_id, 'RELEASE_CLOSEOUT_FAILED', actor, {
    summary: input.summary,
    closed_invocations: open_phase_invocations.map((invocation) => invocation.id),
  });

  return createTextResult(
    `Recorded release closeout failure for feature ${input.feature_id}.`,
    {
      feature,
      failure: {
        summary: input.summary,
        closed_invocations: open_phase_invocations.map((invocation) => invocation.id),
      },
    },
  );
}
