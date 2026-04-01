import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { buildSkillProposalQueue } from '../domain/skill-proposals.js';
import type { GetSkillProposalQueueInput } from '../schemas.js';
import { createTextResult } from '../utils.js';

export async function handleGetSkillProposalQueue(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  input: GetSkillProposalQueueInput,
) {
  const [learnings, domains] = await Promise.all([
    adapter.listAllLearnings(),
    skill_adapter.listKnowledgeDomains(),
  ]);

  const proposals = buildSkillProposalQueue(learnings, domains)
    .filter((proposal) => input.statuses.includes(proposal.status))
    .slice(0, input.limit);

  const ready_count = proposals.filter((proposal) => proposal.status === 'DRAFT_READY').length;

  return createTextResult(
    `Found ${proposals.length} skill proposal candidate(s); ${ready_count} ready for draft generation.`,
    {
      proposals,
      counts: {
        total: proposals.length,
        draft_ready: ready_count,
        candidate: proposals.filter((proposal) => proposal.status === 'CANDIDATE').length,
      },
    },
  );
}
