import { describe, expect, it } from 'vitest';

import type { SkillAdapter } from '../adapters/skills/types.js';
import { InMemoryWorkflowStateAdapter } from '../adapters/workflow-state/in-memory.js';
import { handleCaptureLearning } from './capture-learning.js';

describe('handleCaptureLearning', () => {
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

  it('surfaces proposal candidates for unresolved domain tags', async () => {
    const adapter = new InMemoryWorkflowStateAdapter();

    await adapter.startFeature({
      id: 'FEAT-PROP',
      name: 'Skill Proposal Feature',
      complexity_level: 1,
      severity: 'ROUTINE',
    });
    await adapter.startFeature({
      id: 'FEAT-OTHER',
      name: 'Other Feature',
      complexity_level: 1,
      severity: 'ROUTINE',
    });

    await adapter.captureLearning({
      id: 'seed-learning',
      feature_id: 'FEAT-OTHER',
      phase: '3',
      title: 'Earlier artifact signing gap',
      content: 'We had to hand-roll artifact signing again.',
      category: 'GOTCHA',
      tags: ['artifact-signing'],
      created_by: 'architect-agent',
      created_at: '2026-03-31T09:00:00.000Z',
    });

    const result = await handleCaptureLearning(adapter, skillAdapter, {
      feature_id: 'FEAT-PROP',
      phase: '5',
      title: 'Need artifact signing skill',
      content: 'Builder needs reusable guidance for artifact signing.',
      category: 'PATTERN',
      domain_tags: ['artifact-signing'],
      created_by: 'builder-agent',
    });

    const proposals = (result.structuredContent?.proposal_candidates ?? []) as Array<Record<string, unknown>>;

    expect(result.content[0]?.text).toContain('Surfaced 1 skill proposal candidate');
    expect(proposals[0]).toMatchObject({
      topic_key: 'artifactsigning',
      status: 'CANDIDATE',
      evidence_count: 2,
      feature_count: 2,
    });
  });
});
