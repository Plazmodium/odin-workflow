import { describe, expect, it } from 'vitest';

import { InMemoryWorkflowStateAdapter } from '../adapters/workflow-state/in-memory.js';
import { handleRecordSkillProposalDecision } from './record-skill-proposal-decision.js';

describe('handleRecordSkillProposalDecision', () => {
  it('rejects approval when validation errors remain', async () => {
    const adapter = new InMemoryWorkflowStateAdapter();
    await adapter.upsertSkillProposalDraft({
      topic_key: 'artifactsigning',
      display_name: 'Artifact Signing',
      status: 'DRAFT',
      skill_name: 'artifact-signing',
      skill_category: 'backend',
      draft_markdown: '---\nname: artifact-signing\ncategory: backend\n---\n',
      validation_errors: ['Dependency missing'],
      validation_warnings: [],
      published_path: null,
      decision_notes: null,
      created_by: 'skill-creator-agent',
    });

    const result = await handleRecordSkillProposalDecision(adapter, {
      topic_key: 'artifactsigning',
      status: 'APPROVED',
      decided_by: 'guardian-agent',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('still has 1 validation error');
  });

  it('rejects decisions on published proposals', async () => {
    const adapter = new InMemoryWorkflowStateAdapter();
    await adapter.upsertSkillProposalDraft({
      topic_key: 'artifactsigning',
      display_name: 'Artifact Signing',
      status: 'PUBLISHED',
      skill_name: 'artifact-signing',
      skill_category: 'backend',
      draft_markdown: '---\nname: artifact-signing\ncategory: backend\n---\n',
      validation_errors: [],
      validation_warnings: [],
      published_path: '.odin/skills/generated/backend/artifact-signing/SKILL.md',
      decision_notes: null,
      created_by: 'skill-creator-agent',
    });

    const result = await handleRecordSkillProposalDecision(adapter, {
      topic_key: 'artifactsigning',
      status: 'REJECTED',
      decided_by: 'guardian-agent',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Only drafts can be approved or rejected');
  });
});
