import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { handleRunPolicyChecks } from './run-policy-checks.js';

describe('handleRunPolicyChecks', () => {
  it('returns verdict counts for submitted claims', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-POLICY' })),
      runPolicyChecks: vi.fn(async () => [
        { claim_id: 'c1', claim_type: 'TEST_PASSED', verdict: 'PASS', needs_watcher: false },
        { claim_id: 'c2', claim_type: 'CODE_MODIFIED', verdict: 'NEEDS_REVIEW', needs_watcher: true },
      ]),
      listClaimsNeedingReview: vi.fn(async () => [
        {
          claim_id: 'c2',
          feature_id: 'FEAT-POLICY',
          phase: '5',
          agent_name: 'builder-agent',
          claim_type: 'CODE_MODIFIED',
          claim_description: 'Changed runtime logic',
          evidence_refs: {},
          risk_level: 'LOW',
          policy_verdict: 'NEEDS_REVIEW',
          policy_reason: 'Missing evidence references - escalate to watcher',
          created_at: '2026-03-20T16:10:00.000Z',
        },
      ]),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRunPolicyChecks(adapter, { feature_id: 'FEAT-POLICY' });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      counts: {
        total: 2,
        passed: 1,
        failed: 0,
        needs_review: 1,
      },
      next_actions: [
        'Use odin.get_claims_needing_review to inspect the watcher queue.',
        'Have watcher-agent review each escalated claim and submit verdicts with odin.record_watcher_review.',
        'Re-run odin.verify_claims after watcher reviews are recorded.',
      ],
    });
    expect(result.content[0]?.text).toContain('1 claim(s) now need watcher review');
  });
});
