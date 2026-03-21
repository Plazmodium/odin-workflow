import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { handleSubmitClaim } from './submit-claim.js';

describe('handleSubmitClaim', () => {
  it('normalizes harness labels and reuses the open invocation for the phase agent', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-CLAIM' })),
      findOpenAgentInvocation: vi.fn(async () => ({
        id: 'inv_5',
        feature_id: 'FEAT-CLAIM',
        phase: '5',
        agent_name: 'builder-agent',
        operation: 'Phase 5: Builder',
        skills_used: [],
        started_at: '2026-03-20T16:00:00.000Z',
        ended_at: null,
        duration_ms: null,
      })),
      submitClaim: vi.fn(async (claim) => ({
        id: 'claim_1',
        created_at: '2026-03-20T16:05:00.000Z',
        ...claim,
      })),
    } as unknown as WorkflowStateAdapter;

    const result = await handleSubmitClaim(adapter, {
      feature_id: 'FEAT-CLAIM',
      phase: '5',
      agent_name: 'opencode',
      claim_type: 'TEST_PASSED',
      description: 'Acceptance tests passed',
      evidence_refs: { test_output_hash: 'sha256:abc' },
      risk_level: 'LOW',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.submitClaim).toHaveBeenCalledWith({
      feature_id: 'FEAT-CLAIM',
      phase: '5',
      agent_name: 'builder-agent',
      invocation_id: 'inv_5',
      claim_type: 'TEST_PASSED',
      claim_description: 'Acceptance tests passed',
      evidence_refs: { test_output_hash: 'sha256:abc' },
      risk_level: 'LOW',
    });
  });
});
