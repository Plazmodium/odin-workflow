import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { validateSkillDraft } from '../domain/skill-draft-validation.js';
import { buildSkillProposalQueue } from '../domain/skill-proposals.js';
import type { PublishSkillProposalInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handlePublishSkillProposal(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  project_root: string,
  input: PublishSkillProposalInput,
) {
  const [proposal, proposals, domains] = await Promise.all([
    adapter.listSkillProposals({ statuses: ['APPROVED', 'PUBLISHED', 'DRAFT', 'REJECTED'] }).then((items) =>
      items.find((item) => item.topic_key === input.topic_key) ?? null,
    ),
    adapter.listSkillProposals(),
    skill_adapter.listKnowledgeDomains(),
  ]);

  if (proposal == null) {
    return createErrorResult(`Skill proposal ${input.topic_key} was not found.`, { topic_key: input.topic_key });
  }

  if (proposal.status !== 'APPROVED') {
    return createErrorResult(
      `Skill proposal ${proposal.display_name} is ${proposal.status.toLowerCase()}. Only approved proposals can be published.`,
      { topic_key: proposal.topic_key, status: proposal.status },
    );
  }

  const validation = validateSkillDraft(proposal.draft_markdown, domains, proposals, proposal.topic_key);
  if (!validation.valid || validation.metadata == null || validation.generated_path == null) {
    return createErrorResult(
      `Skill proposal ${proposal.display_name} failed deterministic validation and cannot be published.`,
      {
        topic_key: proposal.topic_key,
        errors: validation.errors,
        warnings: validation.warnings,
      },
    );
  }

  const absolute_path = join(project_root, validation.generated_path);
  const parent_dir = dirname(absolute_path);
  if (!existsSync(parent_dir)) {
    mkdirSync(parent_dir, { recursive: true });
  }

  writeFileSync(absolute_path, proposal.draft_markdown, 'utf8');
  skill_adapter.invalidateCaches();

  let published;
  try {
    published = await adapter.markSkillProposalPublished(
      proposal.topic_key,
      input.published_by,
      validation.generated_path,
    );
  } catch (error) {
    rmSync(absolute_path, { force: true });
    skill_adapter.invalidateCaches();
    throw error;
  }

  let refresh_warning: string | null = null;
  try {
    const refreshed_candidates = buildSkillProposalQueue(await adapter.listAllLearnings(), await skill_adapter.listKnowledgeDomains());
    await adapter.replaceSkillProposalCandidates(refreshed_candidates);
  } catch (error) {
    refresh_warning = error instanceof Error ? error.message : 'Failed to refresh skill proposal candidates after publish.';
  }

  return createTextResult(
    `Published skill proposal ${proposal.display_name} to ${validation.generated_path}.` +
      (refresh_warning == null ? '' : ' Candidate refresh needs a follow-up sync.'),
    {
      proposal: published,
      generated_path: validation.generated_path,
      refresh_warning,
    },
  );
}
