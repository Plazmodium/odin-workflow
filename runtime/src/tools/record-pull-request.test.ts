import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import { handleRecordPullRequest } from './record-pull-request.js';

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

describe('handleRecordPullRequest', () => {
  it('records PR metadata for an existing feature in manual mode', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-PR', base_branch: 'main' })),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGateRecords: vi.fn(async () => []),
      listOpenFindings: vi.fn(async () => []),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => []),
      listClaimsNeedingReview: vi.fn(async () => []),
      recordPullRequest: vi.fn(async () => ({
        feature_id: 'FEAT-PR',
        pr_url: 'https://github.com/org/repo/pull/42',
        pr_number: 42,
      })),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPullRequest(adapter, createConfig('guarded'), {
      feature_id: 'FEAT-PR',
      pr_url: 'https://github.com/org/repo/pull/42',
      pr_number: 42,
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordPullRequest).toHaveBeenCalledWith(
      'FEAT-PR',
      'https://github.com/org/repo/pull/42',
      42
    );
    expect(result.structuredContent?.automation).toMatchObject({
      configured_mode: 'guarded',
      next_human_boundary: 'pr',
    });
  });

  it('returns the current automation snapshot alongside PR metadata', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-PR', base_branch: 'main' })),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGateRecords: vi.fn(async () => []),
      listOpenFindings: vi.fn(async () => []),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => []),
      listClaimsNeedingReview: vi.fn(async () => []),
      recordPullRequest: vi.fn(async () => ({
        feature_id: 'FEAT-PR',
        pr_url: 'https://github.com/org/repo/pull/42',
        pr_number: 42,
      })),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPullRequest(adapter, createConfig('auto_pr'), {
      feature_id: 'FEAT-PR',
      pr_url: 'https://github.com/org/repo/pull/42',
      pr_number: 42,
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.automation).toMatchObject({
      configured_mode: 'auto_pr',
      capabilities: {
        can_open_pr: true,
      },
      next_human_boundary: 'merge',
    });
  });
});
