import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { SkillAdapter } from '../adapters/skills/types.js';
import { InMemoryWorkflowStateAdapter } from '../adapters/workflow-state/in-memory.js';
import { handlePublishSkillProposal } from './publish-skill-proposal.js';

describe('handlePublishSkillProposal', () => {
  it('publishes an approved proposal into .odin/skills/generated', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'odin-skill-publish-'));
    try {
      const adapter = new InMemoryWorkflowStateAdapter();
      await adapter.startFeature({ id: 'FEAT-A', name: 'Feature A', complexity_level: 1, severity: 'ROUTINE' });
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

      await adapter.upsertSkillProposalDraft({
        topic_key: 'artifactsigning',
        display_name: 'Artifact Signing',
        status: 'DRAFT',
        skill_name: 'artifact-signing',
        skill_category: 'backend',
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
        validation_errors: [],
        validation_warnings: [],
        published_path: null,
        decision_notes: null,
        created_by: 'skill-creator-agent',
      });
      await adapter.recordSkillProposalDecision('artifactsigning', 'APPROVED', 'guardian-agent');

      const result = await handlePublishSkillProposal(adapter, skillAdapter, tempRoot, {
        topic_key: 'artifactsigning',
        published_by: 'release-agent',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0]?.text).toContain('.odin/skills/generated/backend/artifact-signing/SKILL.md');

      const filePath = join(tempRoot, '.odin', 'skills', 'generated', 'backend', 'artifact-signing', 'SKILL.md');
      expect(readFileSync(filePath, 'utf8')).toContain('# Artifact Signing');

      const proposals = await adapter.listSkillProposals({ statuses: ['PUBLISHED'] });
      expect(proposals[0]).toMatchObject({
        topic_key: 'artifactsigning',
        status: 'PUBLISHED',
        published_path: '.odin/skills/generated/backend/artifact-signing/SKILL.md',
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('removes the written file if publish state update fails', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'odin-skill-publish-'));
    try {
      const adapter = new InMemoryWorkflowStateAdapter();
      await adapter.upsertSkillProposalDraft({
        topic_key: 'artifactsigning',
        display_name: 'Artifact Signing',
        status: 'DRAFT',
        skill_name: 'artifact-signing',
        skill_category: 'backend',
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
        validation_errors: [],
        validation_warnings: [],
        published_path: null,
        decision_notes: null,
        created_by: 'skill-creator-agent',
      });
      await adapter.recordSkillProposalDecision('artifactsigning', 'APPROVED', 'guardian-agent');

      const failingAdapter = Object.create(adapter) as InMemoryWorkflowStateAdapter;
      failingAdapter.markSkillProposalPublished = async () => {
        throw new Error('database unavailable');
      };

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

      await expect(
        handlePublishSkillProposal(failingAdapter, skillAdapter, tempRoot, {
          topic_key: 'artifactsigning',
          published_by: 'release-agent',
        }),
      ).rejects.toThrow('database unavailable');

      const filePath = join(tempRoot, '.odin', 'skills', 'generated', 'backend', 'artifact-signing', 'SKILL.md');
      expect(() => readFileSync(filePath, 'utf8')).toThrow();
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
