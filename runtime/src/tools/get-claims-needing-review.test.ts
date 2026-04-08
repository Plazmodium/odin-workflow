import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { handleGetClaimsNeedingReview } from './get-claims-needing-review.js';

describe('handleGetClaimsNeedingReview', () => {
  it('returns the watcher queue for a feature', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-WATCH' })),
      listClaimsNeedingReview: vi.fn(async () => [
        {
          claim_id: 'claim_1',
          feature_id: 'FEAT-WATCH',
          phase: '5',
          agent_name: 'builder-agent',
          claim_type: 'CODE_MODIFIED',
          claim_description: 'Updated auth flow',
          evidence_refs: {},
          risk_level: 'HIGH',
          policy_verdict: 'NEEDS_REVIEW',
          policy_reason: 'High risk claim - requires watcher review',
          created_at: '2026-03-20T16:10:00.000Z',
        },
      ]),
    } as unknown as WorkflowStateAdapter;

    const result = await handleGetClaimsNeedingReview(adapter, { feature_id: 'FEAT-WATCH' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('claim_1');
    expect(result.content[0]?.text).toContain('odin.record_watcher_review');
    expect(result.structuredContent?.claims).toHaveLength(1);
  });

  it('reports an empty watcher queue clearly', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-WATCH' })),
      listClaimsNeedingReview: vi.fn(async () => []),
    } as unknown as WorkflowStateAdapter;

    const result = await handleGetClaimsNeedingReview(adapter, { feature_id: 'FEAT-WATCH' });

    expect(result.content[0]?.text).toBe('No claims need watcher review for feature FEAT-WATCH.');
  });
});
