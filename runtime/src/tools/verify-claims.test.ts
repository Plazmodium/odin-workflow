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
    expect(result.content[0]?.text).toContain('claim_1');
    expect(result.content[0]?.text).toContain('odin.record_watcher_review');
    expect(result.structuredContent).toMatchObject({
      counts: {
        needs_review: 1,
      },
      next_actions: [
        'Claim IDs awaiting watcher review: claim_1.',
        'Have watcher-agent review each claim_id listed above.',
        'Record each verdict with odin.record_watcher_review({ claim_id: "<claim_id>", verdict: "PASS" | "FAIL", reasoning: "...", watcher_agent: "watcher-agent", confidence: 0.8 }).',
        'Re-run odin.verify_claims({ feature_id: "FEAT-VERIFY" }) after all watcher reviews are recorded.',
      ],
    });
  });
});
