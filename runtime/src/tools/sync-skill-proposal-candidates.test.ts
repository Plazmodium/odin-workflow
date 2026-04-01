import { describe, expect, it } from 'vitest';

import type { SkillAdapter } from '../adapters/skills/types.js';
import { InMemoryWorkflowStateAdapter } from '../adapters/workflow-state/in-memory.js';
import { handleSyncSkillProposalCandidates } from './sync-skill-proposal-candidates.js';

describe('handleSyncSkillProposalCandidates', () => {
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

  it('persists deterministic skill proposal candidates into workflow state', async () => {
    const adapter = new InMemoryWorkflowStateAdapter();

    await adapter.startFeature({ id: 'FEAT-A', name: 'Feature A', complexity_level: 1, severity: 'ROUTINE' });
    await adapter.startFeature({ id: 'FEAT-B', name: 'Feature B', complexity_level: 1, severity: 'ROUTINE' });
    await adapter.startFeature({ id: 'FEAT-C', name: 'Feature C', complexity_level: 1, severity: 'ROUTINE' });

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
    await adapter.captureLearning({
      id: 'learn-c',
      feature_id: 'FEAT-C',
      phase: '6',
      title: 'Review missed provenance',
      content: 'Need provenance-attestation guidance.',
      category: 'INTEGRATION',
      tags: ['artifact-signing', 'provenance-attestation'],
      created_by: 'reviewer-agent',
      created_at: '2026-03-31T12:00:00.000Z',
    });

    const result = await handleSyncSkillProposalCandidates(adapter, skillAdapter, {});
    const persisted = await adapter.listSkillProposalCandidates({ statuses: ['DRAFT_READY', 'CANDIDATE'] });

    expect(result.content[0]?.text).toContain('Synced 2 skill proposal candidate');
    expect(persisted[0]).toMatchObject({
      topic_key: 'artifactsigning',
      status: 'DRAFT_READY',
    });
    expect(persisted[1]).toMatchObject({
      topic_key: 'provenanceattestation',
      status: 'CANDIDATE',
    });
  });
});
