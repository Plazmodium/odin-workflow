import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { GetSkillProposalsInput } from '../schemas.js';
import { createTextResult } from '../utils.js';

export async function handleGetSkillProposals(
  adapter: WorkflowStateAdapter,
  input: GetSkillProposalsInput,
) {
  const proposals = await adapter.listSkillProposals({
    statuses: input.statuses,
    limit: input.limit,
  });

  return createTextResult(`Found ${proposals.length} skill proposal draft/review record(s).`, {
    proposals,
  });
}
