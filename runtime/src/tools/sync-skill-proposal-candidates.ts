import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { buildSkillProposalQueue } from '../domain/skill-proposals.js';
import type { SyncSkillProposalCandidatesInput } from '../schemas.js';
import { createTextResult } from '../utils.js';

export async function handleSyncSkillProposalCandidates(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  _input: SyncSkillProposalCandidatesInput,
) {
  const [learnings, domains] = await Promise.all([
    adapter.listAllLearnings(),
    skill_adapter.listKnowledgeDomains(),
  ]);

  const proposals = buildSkillProposalQueue(learnings, domains);
  await adapter.replaceSkillProposalCandidates(proposals);

  const draft_ready = proposals.filter((proposal) => proposal.status === 'DRAFT_READY').length;

  return createTextResult(
    `Synced ${proposals.length} skill proposal candidate(s); ${draft_ready} are draft-ready.`,
    {
      proposals,
      counts: {
        total: proposals.length,
        draft_ready,
        candidate: proposals.filter((proposal) => proposal.status === 'CANDIDATE').length,
      },
    },
  );
}
