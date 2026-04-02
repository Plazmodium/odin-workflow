import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import { handleRecordMerge } from './record-merge.js';

function createConfig(mode: 'guarded' | 'auto_pr'): RuntimeConfig {
  return {
    runtime: { mode: 'in_memory' },
    automation: {
      mode,
      allowed_base_branches: ['main'],
      require_green_checks: true,
      require_clean_policy_checks: true,
      require_no_open_blockers: true,
      require_watched_claims_verified: true,
      paused: false,
      kill_switch: false,
      merge_strategy: 'squash',
    },
  };
}

describe('handleRecordMerge', () => {
  it('records merge metadata for an existing feature', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-MERGE', base_branch: 'main' })),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGateRecords: vi.fn(async () => []),
      listOpenFindings: vi.fn(async () => []),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => []),
      listClaimsNeedingReview: vi.fn(async () => []),
      recordMerge: vi.fn(async () => ({
        feature_id: 'FEAT-MERGE',
        merged_at: '2026-03-20T15:30:00.000Z',
        merged_by: 'human',
        pr_url: 'https://github.com/org/repo/pull/42',
        pr_number: 42,
      })),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordMerge(adapter, createConfig('guarded'), {
      feature_id: 'FEAT-MERGE',
      merged_by: 'human',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordMerge).toHaveBeenCalledWith('FEAT-MERGE', 'human');
    expect(result.structuredContent?.merge).toMatchObject({
      feature_id: 'FEAT-MERGE',
      merged_by: 'human',
    });
    expect(result.structuredContent?.automation).toMatchObject({
      configured_mode: 'guarded',
      next_human_boundary: 'pr',
    });
  });

  it('returns the current automation snapshot alongside merge metadata', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-MERGE', base_branch: 'main' })),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGateRecords: vi.fn(async () => []),
      listOpenFindings: vi.fn(async () => []),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => []),
      listClaimsNeedingReview: vi.fn(async () => []),
      recordMerge: vi.fn(async () => ({
        feature_id: 'FEAT-MERGE',
        merged_at: '2026-03-20T15:30:00.000Z',
        merged_by: 'human',
      })),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordMerge(adapter, createConfig('auto_pr'), {
      feature_id: 'FEAT-MERGE',
      merged_by: 'human',
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.automation).toMatchObject({
      configured_mode: 'auto_pr',
      capabilities: {
        can_merge: false,
      },
      next_human_boundary: 'merge',
    });
  });
});
