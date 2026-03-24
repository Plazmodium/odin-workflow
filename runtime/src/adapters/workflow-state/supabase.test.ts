import { describe, expect, it, vi } from 'vitest';

import type { RuntimeConfig } from '../../config.js';
import { SupabaseWorkflowStateAdapter, shouldTransitionPhaseResult } from './supabase.js';

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
