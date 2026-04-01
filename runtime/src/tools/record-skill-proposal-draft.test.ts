import { describe, expect, it } from 'vitest';

import type { SkillAdapter } from '../adapters/skills/types.js';
import { InMemoryWorkflowStateAdapter } from '../adapters/workflow-state/in-memory.js';
import { handleRecordSkillProposalDraft } from './record-skill-proposal-draft.js';

const skillAdapter: SkillAdapter = {
  listKnowledgeDomains: async () => [
    {
      id: 'nextjs-dev',
      name: 'nextjs-dev',
      target_type: 'skill',
      target_path: 'frontend/nextjs-dev',
      strong_keywords: ['nextjs'],
      weak_keywords: [],
    },
  ],
  resolveSkills: async () => ({ resolved: [], fallback_used: true }),
  invalidateCaches() {},
};

describe('handleRecordSkillProposalDraft', () => {
  it('stores a draft and validation result for a queued topic', async () => {
    const adapter = new InMemoryWorkflowStateAdapter();
    await adapter.replaceSkillProposalCandidates([
      {
        topic_key: 'artifactsigning',
        display_name: 'Artifact Signing',
        status: 'DRAFT_READY',
        evidence_count: 3,
        feature_count: 2,
        sample_tags: ['artifact-signing'],
        latest_learning_at: '2026-03-31T12:00:00.000Z',
        recent_examples: [],
      },
    ]);

    const result = await handleRecordSkillProposalDraft(adapter, skillAdapter, {
      topic_key: 'artifactsigning',
      drafted_by: 'skill-creator-agent',
      draft_markdown: `---
name: artifact-signing
description: Guidance for deterministic artifact signing.
category: backend
depends_on:
  - nextjs-dev
---

# Artifact Signing

Use deterministic artifact signing for generated releases.
`,
    });

    const proposals = await adapter.listSkillProposals();
    expect(result.isError).toBeUndefined();
    expect(proposals[0]).toMatchObject({
      topic_key: 'artifactsigning',
      status: 'DRAFT',
      skill_name: 'artifact-signing',
      skill_category: 'backend',
      validation_errors: [],
    });
  });

  it('can fall back to the live computed queue when persisted candidates are missing', async () => {
    const adapter = new InMemoryWorkflowStateAdapter();
    await adapter.startFeature({ id: 'FEAT-A', name: 'Feature A', complexity_level: 1, severity: 'ROUTINE' });
    await adapter.startFeature({ id: 'FEAT-B', name: 'Feature B', complexity_level: 1, severity: 'ROUTINE' });

    await adapter.captureLearning({
      id: 'learn-a',
      feature_id: 'FEAT-A',
      phase: '3',
      title: 'Need artifact signing',
      content: 'Artifact signing should be standardized.',
      category: 'PATTERN',
      tags: ['artifact-signing'],
      created_by: 'architect-agent',
      created_at: '2026-03-31T10:00:00.000Z',
    });
    await adapter.captureLearning({
      id: 'learn-b',
      feature_id: 'FEAT-B',
      phase: '5',
      title: 'Artifact signing drift',
      content: 'Builder had to duplicate artifact signing steps.',
      category: 'GOTCHA',
      tags: ['artifact-signing'],
      created_by: 'builder-agent',
      created_at: '2026-03-31T11:00:00.000Z',
    });

    const result = await handleRecordSkillProposalDraft(adapter, skillAdapter, {
      topic_key: 'artifactsigning',
      drafted_by: 'skill-creator-agent',
      draft_markdown: `---
name: artifact-signing
description: Guidance for deterministic artifact signing.
category: backend
depends_on:
  - nextjs-dev
---

# Artifact Signing

Use deterministic artifact signing for generated releases.
`,
    });

    expect(result.isError).toBeUndefined();
    const proposals = await adapter.listSkillProposals();
    expect(proposals[0]?.topic_key).toBe('artifactsigning');
    expect((await adapter.listSkillProposalCandidates()).length).toBe(1);
  });
});
