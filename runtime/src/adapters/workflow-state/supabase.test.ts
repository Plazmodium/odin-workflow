import { describe, expect, it, vi } from 'vitest';

import type { RuntimeConfig } from '../../config.js';
import { SupabaseWorkflowStateAdapter, shouldCompleteFeatureFromPhaseResult, shouldTransitionPhaseResult } from './supabase.js';

describe('shouldTransitionPhaseResult', () => {
  it('transitions completed results when next phase differs', () => {
    expect(
      shouldTransitionPhaseResult({
        id: 'result_1',
        feature_id: 'FEAT-001',
        phase: '1',
        outcome: 'completed',
        summary: 'done',
        next_phase: '2',
        blockers: [],
        created_by: 'tester',
        created_at: '2026-03-13T00:00:00.000Z',
      })
    ).toBe(true);
  });

  it('transitions needs_rework results when next phase differs', () => {
    expect(
      shouldTransitionPhaseResult({
        id: 'result_2',
        feature_id: 'FEAT-001',
        phase: '5',
        outcome: 'needs_rework',
        summary: 'go back',
        next_phase: '4',
        blockers: [],
        created_by: 'tester',
        created_at: '2026-03-13T00:00:00.000Z',
      })
    ).toBe(true);
  });

  it('does not transition blocked results', () => {
    expect(
      shouldTransitionPhaseResult({
        id: 'result_3',
        feature_id: 'FEAT-001',
        phase: '6',
        outcome: 'blocked',
        summary: 'blocked',
        next_phase: '7',
        blockers: ['Needs decision'],
        created_by: 'tester',
        created_at: '2026-03-13T00:00:00.000Z',
      })
    ).toBe(false);
  });
});

describe('shouldCompleteFeatureFromPhaseResult', () => {
  it('completes only the merged Release handoff transition to phase 10', () => {
    expect(
      shouldCompleteFeatureFromPhaseResult({
        id: 'result_release',
        feature_id: 'FEAT-001',
        phase: '9',
        outcome: 'completed',
        summary: 'release done',
        next_phase: '10',
        blockers: [],
        created_by: 'release-agent',
        created_at: '2026-03-13T00:00:00.000Z',
      })
    ).toBe(true);

    expect(
      shouldCompleteFeatureFromPhaseResult({
        id: 'result_builder',
        feature_id: 'FEAT-001',
        phase: '5',
        outcome: 'completed',
        summary: 'builder done',
        next_phase: '6',
        blockers: [],
        created_by: 'builder-agent',
        created_at: '2026-03-13T00:00:00.000Z',
      })
    ).toBe(false);
  });
});

describe('SupabaseWorkflowStateAdapter.recordCommit', () => {
  function createAdapterWithRpc(rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: null }>) {
    const adapter = new SupabaseWorkflowStateAdapter({
      supabase: {
        url: 'https://example.supabase.co',
        secret_key: 'test-secret-key',
      },
    } as RuntimeConfig);

    Object.assign(adapter, {
      client: {
        rpc,
      },
    });

    return adapter;
  }

  it('accepts object-shaped RPC responses when recording commits', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        feature_id: 'FEAT-COMMIT',
        commit_hash: 'abc123',
        phase: '5',
        message: 'feat: add tests',
        files_changed: 3,
        insertions: 42,
        deletions: 5,
        committed_at: '2026-03-24T12:00:00.000Z',
        committed_by: 'builder-agent',
      },
      error: null,
    }));

    const adapter = createAdapterWithRpc(rpc);
    const commit = await adapter.recordCommit({
      feature_id: 'FEAT-COMMIT',
      commit_hash: 'abc123',
      phase: '5',
      message: 'feat: add tests',
      files_changed: 3,
      insertions: 42,
      deletions: 5,
      committed_by: 'builder-agent',
    });

    expect(commit).toMatchObject({
      feature_id: 'FEAT-COMMIT',
      commit_hash: 'abc123',
      committed_by: 'builder-agent',
    });
  });
});

describe('SupabaseWorkflowStateAdapter.getFeature', () => {
  function createAdapterWithRpc(rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: null }>) {
    const adapter = new SupabaseWorkflowStateAdapter({
      supabase: {
        url: 'https://example.supabase.co',
        secret_key: 'test-secret-key',
      },
    } as RuntimeConfig);

    Object.assign(adapter, {
      client: {
        rpc,
      },
    });

    return adapter;
  }

  it('returns null when get_feature_status returns no rows', async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const adapter = createAdapterWithRpc(rpc);

    await expect(adapter.getFeature('MISSING')).resolves.toBeNull();
  });
});

describe('SupabaseWorkflowStateAdapter.listAgentInvocations', () => {
  function createAdapterWithClient(client: Record<string, unknown>) {
    const adapter = new SupabaseWorkflowStateAdapter({
      supabase: {
        url: 'https://example.supabase.co',
        secret_key: 'test-secret-key',
      },
    } as RuntimeConfig);

    Object.assign(adapter, { client });
    return adapter;
  }

  it('maps completed invocation rows from Supabase', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn(async () => ({
        data: [
          {
            id: 'inv_1',
            feature_id: 'FEAT-INV',
            phase: '5',
            agent_name: 'builder-agent',
            operation: 'Phase 5: Builder',
            skills_used: ['testing/vitest'],
            started_at: '2026-04-01T10:00:00.000Z',
            ended_at: '2026-04-01T10:10:00.000Z',
            duration_ms: 600000,
          },
        ],
        error: null,
      })),
    };

    const from = vi.fn(() => query);
    const adapter = createAdapterWithClient({ from });
    const invocations = await adapter.listAgentInvocations('FEAT-INV');

    expect(from).toHaveBeenCalledWith('agent_invocations');
    expect(invocations).toEqual([
      {
        id: 'inv_1',
        feature_id: 'FEAT-INV',
        phase: '5',
        agent_name: 'builder-agent',
        operation: 'Phase 5: Builder',
        skills_used: ['testing/vitest'],
        started_at: '2026-04-01T10:00:00.000Z',
        ended_at: '2026-04-01T10:10:00.000Z',
        duration_ms: 600000,
      },
    ]);
  });
});

describe('SupabaseWorkflowStateAdapter.completeFeature', () => {
  function createAdapterWithClient(client: Record<string, unknown>) {
    const adapter = new SupabaseWorkflowStateAdapter({
      supabase: {
        url: 'https://example.supabase.co',
        secret_key: 'test-secret-key',
      },
    } as RuntimeConfig);

    Object.assign(adapter, { client });
    return adapter;
  }

  it('calls the completion RPC and returns the refreshed feature record', async () => {
    const rpc = vi.fn(async (fn: string) => {
      if (fn === 'complete_feature') {
        return { data: true, error: null };
      }

      if (fn === 'get_feature_status') {
        return {
          data: {
            feature_id: 'FEAT-DONE',
            feature_name: 'Done',
            status: 'COMPLETED',
            current_phase: '10',
            complexity_level: 2,
            severity: 'ROUTINE',
            pr_url: 'https://github.com/org/repo/pull/42',
            pr_number: 42,
            merged_at: '2026-04-02T00:00:00.000Z',
            completed_at: '2026-04-02T00:05:00.000Z',
            created_at: '2026-04-01T00:00:00.000Z',
            updated_at: '2026-04-02T00:05:00.000Z',
          },
          error: null,
        };
      }

      throw new Error(`Unexpected RPC ${fn}`);
    });
    const adapter = createAdapterWithClient({ rpc });

    const feature = await adapter.completeFeature('FEAT-DONE', 'release-agent');

    expect(rpc).toHaveBeenCalledWith('complete_feature', {
      p_feature_id: 'FEAT-DONE',
      p_completed_by: 'release-agent',
    });
    expect(feature).toMatchObject({
      id: 'FEAT-DONE',
      status: 'COMPLETED',
      current_phase: '10',
      merged_at: '2026-04-02T00:00:00.000Z',
      completed_at: '2026-04-02T00:05:00.000Z',
    });
  });
});

describe('SupabaseWorkflowStateAdapter skill proposal persistence', () => {
  function createAdapterWithClient(client: Record<string, unknown>) {
    const adapter = new SupabaseWorkflowStateAdapter({
      supabase: {
        url: 'https://example.supabase.co',
        secret_key: 'test-secret-key',
      },
    } as RuntimeConfig);

    Object.assign(adapter, { client });
    return adapter;
  }

  it('replaces skill proposal candidates through one RPC call', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const adapter = createAdapterWithClient({ rpc });

    await adapter.replaceSkillProposalCandidates([
      {
        topic_key: 'artifactsigning',
        display_name: 'Artifact Signing',
        status: 'DRAFT_READY',
        evidence_count: 3,
        feature_count: 2,
        sample_tags: ['artifact-signing'],
        latest_learning_at: '2026-03-31T12:00:00.000Z',
        recent_examples: [
          {
            learning_id: 'learn-1',
            title: 'Need artifact signing',
            feature_id: 'FEAT-A',
            created_at: '2026-03-31T12:00:00.000Z',
          },
        ],
      },
    ]);

    expect(rpc).toHaveBeenCalledWith('replace_skill_proposal_candidates', {
      p_candidates: [
        expect.objectContaining({
          topic_key: 'artifactsigning',
          status: 'DRAFT_READY',
          recent_examples: [
            expect.objectContaining({
              learning_id: 'learn-1',
              feature_id: 'FEAT-A',
            }),
          ],
        }),
      ],
    });
  });

  it('hydrates proposal evidence and applies status filtering before limit', async () => {
    let requested_statuses: string[] = [];
    const candidate_query = {
      in: vi.fn((_: string, statuses: string[]) => {
        requested_statuses = statuses;
        return candidate_query;
      }),
      then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
        resolve({
          data: [
            {
              topic_key: 'artifactsigning',
              display_name: 'Artifact Signing',
              status: 'DRAFT_READY',
              evidence_count: 3,
              feature_count: 3,
              sample_tags: ['artifact-signing'],
              latest_learning_at: '2026-03-31T12:00:00.000Z',
            },
            {
              topic_key: 'provenanceattestation',
              display_name: 'Provenance Attestation',
              status: 'CANDIDATE',
              evidence_count: 1,
              feature_count: 1,
              sample_tags: ['provenance-attestation'],
              latest_learning_at: '2026-03-31T11:00:00.000Z',
            },
          ].filter((row) => requested_statuses.length === 0 || requested_statuses.includes(row.status)),
          error: null,
        }),
    };

    const evidence_query = {
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
        resolve({
          data: [
            {
              proposal_topic_key: 'provenanceattestation',
              learning_id: 'learn-2',
              feature_id: 'FEAT-B',
              title: 'Need provenance attestation',
              learning_created_at: '2026-03-31T11:00:00.000Z',
            },
          ],
          error: null,
        }),
    };

    const from = vi.fn((table: string) => {
      if (table === 'skill_proposal_candidates') {
        return { select: vi.fn(() => candidate_query) };
      }

      if (table === 'skill_proposal_evidence') {
        return { select: vi.fn(() => evidence_query) };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const adapter = createAdapterWithClient({ from });
    const proposals = await adapter.listSkillProposalCandidates({ statuses: ['CANDIDATE'], limit: 1 });

    expect(candidate_query.in).toHaveBeenCalledWith('status', ['CANDIDATE']);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      topic_key: 'provenanceattestation',
      status: 'CANDIDATE',
      recent_examples: [
        expect.objectContaining({
          learning_id: 'learn-2',
          feature_id: 'FEAT-B',
        }),
      ],
    });
  });

  it('stores and updates skill proposal workflow rows', async () => {
    const upsert_chain = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({
        data: {
          topic_key: 'artifactsigning',
          display_name: 'Artifact Signing',
          status: 'DRAFT',
          skill_name: 'artifact-signing',
          skill_category: 'backend',
          draft_markdown: 'draft',
          validation_errors: [],
          validation_warnings: [],
          decision_notes: null,
          created_by: 'skill-creator-agent',
          created_at: '2026-03-31T10:00:00.000Z',
          updated_at: '2026-03-31T10:05:00.000Z',
          approved_by: null,
          approved_at: null,
          published_by: null,
          published_at: null,
          published_path: null,
        },
        error: null,
      })),
    };

    const update_chain = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({
        data: {
          topic_key: 'artifactsigning',
          display_name: 'Artifact Signing',
          status: 'APPROVED',
          skill_name: 'artifact-signing',
          skill_category: 'backend',
          draft_markdown: 'draft',
          validation_errors: [],
          validation_warnings: [],
          decision_notes: 'looks good',
          created_by: 'skill-creator-agent',
          created_at: '2026-03-31T10:00:00.000Z',
          updated_at: '2026-03-31T10:06:00.000Z',
          approved_by: 'guardian-agent',
          approved_at: '2026-03-31T10:06:00.000Z',
          published_by: null,
          published_at: null,
          published_path: null,
        },
        error: null,
      })),
    };

    const from = vi.fn((table: string) => {
      if (table !== 'skill_proposals') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        upsert: vi.fn(() => upsert_chain),
        update: vi.fn(() => update_chain),
      };
    });

    const adapter = createAdapterWithClient({ from });
    const draft = await adapter.upsertSkillProposalDraft({
      topic_key: 'artifactsigning',
      display_name: 'Artifact Signing',
      status: 'DRAFT',
      skill_name: 'artifact-signing',
      skill_category: 'backend',
      draft_markdown: 'draft',
      validation_errors: [],
      validation_warnings: [],
      published_path: null,
      decision_notes: null,
      created_by: 'skill-creator-agent',
    });

    expect(draft.status).toBe('DRAFT');

    const approved = await adapter.recordSkillProposalDecision(
      'artifactsigning',
      'APPROVED',
      'guardian-agent',
      'looks good',
    );

    expect(update_chain.eq).toHaveBeenCalledWith('topic_key', 'artifactsigning');
    expect(update_chain.eq).toHaveBeenCalledWith('status', 'DRAFT');
    expect(approved).toMatchObject({
      status: 'APPROVED',
      approved_by: 'guardian-agent',
      decision_notes: 'looks good',
    });
  });

  it('requires approved status when marking a proposal as published', async () => {
    const update_chain = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({
        data: {
          topic_key: 'artifactsigning',
          display_name: 'Artifact Signing',
          status: 'PUBLISHED',
          skill_name: 'artifact-signing',
          skill_category: 'backend',
          draft_markdown: 'draft',
          validation_errors: [],
          validation_warnings: [],
          decision_notes: null,
          created_by: 'skill-creator-agent',
          created_at: '2026-03-31T10:00:00.000Z',
          updated_at: '2026-03-31T10:07:00.000Z',
          approved_by: 'guardian-agent',
          approved_at: '2026-03-31T10:06:00.000Z',
          published_by: 'release-agent',
          published_at: '2026-03-31T10:07:00.000Z',
          published_path: '.odin/skills/generated/backend/artifact-signing/SKILL.md',
        },
        error: null,
      })),
    };

    const from = vi.fn((table: string) => {
      if (table !== 'skill_proposals') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        update: vi.fn(() => update_chain),
      };
    });

    const adapter = createAdapterWithClient({ from });
    const published = await adapter.markSkillProposalPublished(
      'artifactsigning',
      'release-agent',
      '.odin/skills/generated/backend/artifact-signing/SKILL.md',
    );

    expect(update_chain.eq).toHaveBeenCalledWith('topic_key', 'artifactsigning');
    expect(update_chain.eq).toHaveBeenCalledWith('status', 'APPROVED');
    expect(published.status).toBe('PUBLISHED');
  });
});
