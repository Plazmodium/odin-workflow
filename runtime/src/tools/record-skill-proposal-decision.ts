import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RecordSkillProposalDecisionInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleRecordSkillProposalDecision(
  adapter: WorkflowStateAdapter,
  input: RecordSkillProposalDecisionInput,
) {
  const proposal = (await adapter.listSkillProposals()).find((item) => item.topic_key === input.topic_key) ?? null;
  if (proposal == null) {
    return createErrorResult(`Skill proposal ${input.topic_key} was not found.`, { topic_key: input.topic_key });
  }

  if (proposal.status !== 'DRAFT') {
    return createErrorResult(
      `Skill proposal ${proposal.display_name} is ${proposal.status.toLowerCase()}. Only drafts can be approved or rejected.`,
      {
        topic_key: proposal.topic_key,
        status: proposal.status,
      },
    );
  }

  if (input.status === 'APPROVED' && proposal.validation_errors.length > 0) {
    return createErrorResult(
      `Skill proposal ${input.topic_key} still has ${proposal.validation_errors.length} validation error(s). Fix the draft before approval.`,
      {
        topic_key: input.topic_key,
        validation_errors: proposal.validation_errors,
      },
    );
  }

  const updated = await adapter.recordSkillProposalDecision(
    input.topic_key,
    input.status,
    input.decided_by,
    input.notes,
  );

  return createTextResult(
    `${input.status === 'APPROVED' ? 'Approved' : 'Rejected'} skill proposal ${updated.display_name}.`,
    { proposal: updated },
  );
}
