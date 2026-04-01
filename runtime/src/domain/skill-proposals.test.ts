import { describe, expect, it } from 'vitest';

import { buildSkillProposalQueue, collectSkillProposalSignals, computeSkillProposalStatus } from './skill-proposals.js';
import type { KnowledgeDomain, LearningRecord } from '../types.js';

describe('collectSkillProposalSignals', () => {
  it('filters out tags already covered by persisted matches', () => {
    const signals = collectSkillProposalSignals(
      ['nextjs', 'artifact-signing', 'provenance-attestation'],
      [
        {
          domain: {
            id: 'nextjs-dev',
            name: 'nextjs-dev',
            target_type: 'skill',
            target_path: 'frontend/nextjs-dev',
            strong_keywords: ['nextjs'],
            weak_keywords: [],
          },
          relevance: 0.75,
          strong_matches: ['nextjs'],
          weak_matches: [],
          persisted: true,
        },
      ],
    );

    expect(signals).toEqual([
      {
        topic_key: 'artifactsigning',
        display_name: 'Artifact Signing',
        raw_tag: 'artifact-signing',
      },
      {
        topic_key: 'provenanceattestation',
        display_name: 'Provenance Attestation',
        raw_tag: 'provenance-attestation',
      },
    ]);
  });
});

describe('computeSkillProposalStatus', () => {
  it('marks repeated cross-feature signals as draft ready', () => {
    expect(computeSkillProposalStatus(3, 2)).toBe('DRAFT_READY');
    expect(computeSkillProposalStatus(2, 2)).toBe('CANDIDATE');
  });
});

describe('buildSkillProposalQueue', () => {
  it('aggregates unresolved tags into draft-ready proposal candidates', () => {
    const learnings: LearningRecord[] = [
      {
        id: 'learn-1',
        feature_id: 'FEAT-A',
        phase: '3',
        title: 'Use deterministic artifact signing',
        content: 'Need artifact signing for generated archives.',
        category: 'PATTERN',
        tags: ['artifact-signing'],
        created_by: 'architect-agent',
        created_at: '2026-03-31T10:00:00.000Z',
      },
      {
        id: 'learn-2',
        feature_id: 'FEAT-B',
        phase: '5',
        title: 'Propagate provenance attestations',
        content: 'Generated assets need provenance attestation.',
        category: 'INTEGRATION',
        tags: ['artifact-signing', 'provenance-attestation'],
        created_by: 'builder-agent',
        created_at: '2026-03-31T11:00:00.000Z',
      },
      {
        id: 'learn-3',
        feature_id: 'FEAT-C',
        phase: '6',
        title: 'Keep artifact signing stable',
        content: 'Review found signing drift without explicit skill support.',
        category: 'GOTCHA',
        tags: ['artifact-signing'],
        created_by: 'reviewer-agent',
        created_at: '2026-03-31T12:00:00.000Z',
      },
    ];

    const domains: KnowledgeDomain[] = [
      {
        id: 'nextjs-dev',
        name: 'nextjs-dev',
        target_type: 'skill',
        target_path: 'frontend/nextjs-dev',
        strong_keywords: ['nextjs'],
        weak_keywords: [],
      },
    ];

    const queue = buildSkillProposalQueue(learnings, domains);

    expect(queue[0]).toMatchObject({
      topic_key: 'artifactsigning',
      display_name: 'Artifact Signing',
      status: 'DRAFT_READY',
      evidence_count: 3,
      feature_count: 3,
    });
    expect(queue[0]?.recent_examples).toHaveLength(3);
    expect(queue[1]).toMatchObject({
      topic_key: 'provenanceattestation',
      status: 'CANDIDATE',
      evidence_count: 1,
      feature_count: 1,
    });
  });
});
