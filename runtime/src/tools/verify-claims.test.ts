import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { handleVerifyClaims } from './verify-claims.js';

describe('handleVerifyClaims', () => {
  it('returns explicit next actions when claims still await watcher review', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-VERIFY' })),
      listClaimVerificationStatus: vi.fn(async () => [
        {
          claim_id: 'claim_1',
          claim_type: 'CODE_MODIFIED',
          agent_name: 'builder-agent',
          risk_level: 'LOW',
          policy_verdict: 'NEEDS_REVIEW',
          watcher_verdict: null,
          final_status: 'NEEDS_REVIEW',
        },
      ]),
      listClaimsNeedingReview: vi.fn(async () => [
        {
          claim_id: 'claim_1',
          feature_id: 'FEAT-VERIFY',
          phase: '5',
          agent_name: 'builder-agent',
          claim_type: 'CODE_MODIFIED',
          claim_description: 'Updated runtime implementation',
          evidence_refs: {},
          risk_level: 'LOW',
          policy_verdict: 'NEEDS_REVIEW',
          policy_reason: 'Missing evidence references - escalate to watcher',
          created_at: '2026-03-24T12:00:00.000Z',
        },
      ]),
    } as unknown as WorkflowStateAdapter;

    const result = await handleVerifyClaims(adapter, { feature_id: 'FEAT-VERIFY' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('still await watcher review');
    expect(result.structuredContent).toMatchObject({
      counts: {
        needs_review: 1,
      },
      next_actions: [
        'Claims are still awaiting LLM watcher review.',
        'Call odin.get_claims_needing_review to fetch the queue for the watcher-agent.',
        'Record each watcher decision with odin.record_watcher_review, then run odin.verify_claims again.',
      ],
    });
  });
});
