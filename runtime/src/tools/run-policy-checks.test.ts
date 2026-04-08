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
        'Claim IDs now needing watcher review: c2.',
        'Call odin.get_claims_needing_review to inspect the full watcher queue and evidence.',
        'Have watcher-agent review each claim_id listed above.',
        'Record each verdict with odin.record_watcher_review({ claim_id: "<claim_id>", verdict: "PASS" | "FAIL", reasoning: "...", watcher_agent: "watcher-agent", confidence: 0.8 }).',
        'Re-run odin.verify_claims({ feature_id: "FEAT-POLICY" }) after all watcher reviews are recorded.',
      ],
    });
    expect(result.content[0]?.text).toContain('1 claim(s) now need watcher review');
    expect(result.content[0]?.text).toContain('c2');
  });
});
