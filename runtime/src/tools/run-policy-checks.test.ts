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
    });
  });
});
