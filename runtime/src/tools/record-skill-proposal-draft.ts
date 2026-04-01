import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { validateSkillDraft } from '../domain/skill-draft-validation.js';
import { buildSkillProposalQueue } from '../domain/skill-proposals.js';
import type { RecordSkillProposalDraftInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

function titleize(topic_key: string): string {
  return topic_key
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

export async function handleRecordSkillProposalDraft(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  input: RecordSkillProposalDraftInput,
) {
  const [candidates, proposals, domains] = await Promise.all([
    adapter.listSkillProposalCandidates(),
    adapter.listSkillProposals(),
    skill_adapter.listKnowledgeDomains(),
  ]);

  const existing = proposals.find((proposal) => proposal.topic_key === input.topic_key) ?? null;
  let candidate = candidates.find((item) => item.topic_key === input.topic_key) ?? null;

  if (candidate == null && existing == null) {
    const live_queue = buildSkillProposalQueue(await adapter.listAllLearnings(), domains);
    candidate = live_queue.find((item) => item.topic_key === input.topic_key) ?? null;
    if (candidate != null) {
      await adapter.replaceSkillProposalCandidates(live_queue);
    }
  }

  if (existing?.status === 'PUBLISHED') {
    return createErrorResult(
      `Skill proposal ${input.topic_key} is already published. Create a new topic or add revision workflow support before redrafting it.`,
      { topic_key: input.topic_key },
    );
  }

  if (candidate == null && existing == null) {
    return createErrorResult(
      `Skill proposal topic ${input.topic_key} was not found. Run odin.get_skill_proposal_queue or odin.sync_skill_proposal_candidates first.`,
      { topic_key: input.topic_key },
    );
  }

  const validation = validateSkillDraft(input.draft_markdown, domains, proposals, input.topic_key);
  if (validation.metadata == null) {
    return createErrorResult('Skill draft frontmatter is invalid.', {
      topic_key: input.topic_key,
      errors: validation.errors,
    });
  }

  const saved = await adapter.upsertSkillProposalDraft({
    topic_key: input.topic_key,
    display_name: candidate?.display_name ?? existing?.display_name ?? titleize(input.topic_key),
    status: 'DRAFT',
    skill_name: validation.metadata.name,
    skill_category: validation.metadata.category,
    draft_markdown: input.draft_markdown,
    validation_errors: validation.errors,
    validation_warnings: validation.warnings,
    published_path: null,
    decision_notes: null,
    created_by: existing?.created_by ?? input.drafted_by,
  });

  const summary = validation.valid
    ? `Recorded draft for ${saved.display_name}. Deterministic validation passed.`
    : `Recorded draft for ${saved.display_name}. Deterministic validation found ${validation.errors.length} issue(s).`;

  return createTextResult(summary, {
    proposal: saved,
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      generated_path: validation.generated_path,
    },
  });
}
