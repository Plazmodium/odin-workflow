/**
 * Record Commit Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import { getPhaseAgentInstructions } from '../domain/phases.js';
import type { RecordCommitInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleRecordCommit(
  adapter: WorkflowStateAdapter,
  input: RecordCommitInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const committed_by = resolveWorkflowActorName(
    input.phase,
    input.committed_by ?? getPhaseAgentInstructions(input.phase).name
  );

  const commit = await adapter.recordCommit({
    feature_id: input.feature_id,
    commit_hash: input.commit_hash,
    phase: input.phase,
    message: input.message,
    files_changed: input.files_changed,
    insertions: input.insertions,
    deletions: input.deletions,
    committed_by,
  });

  return createTextResult(
    `Recorded commit ${commit.commit_hash} for feature ${commit.feature_id}.`,
    { commit }
  );
}
