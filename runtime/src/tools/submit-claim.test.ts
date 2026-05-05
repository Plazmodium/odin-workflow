import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { handleSubmitClaim } from './submit-claim.js';

describe('handleSubmitClaim', () => {
  it('normalizes harness labels and reuses the open invocation for the phase agent', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-CLAIM', current_phase: '5' })),
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

  it('merges structured evidence fields into persisted evidence refs', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-CLAIM', current_phase: '7' })),
      findOpenAgentInvocation: vi.fn(async () => null),
      submitClaim: vi.fn(async (claim) => ({
        id: 'claim_1',
        created_at: '2026-03-20T16:05:00.000Z',
        ...claim,
      })),
    } as unknown as WorkflowStateAdapter;

    const result = await handleSubmitClaim(adapter, {
      feature_id: 'FEAT-CLAIM',
      phase: '7',
      claim_type: 'INTEGRATION_VERIFIED',
      description: 'Integration verification passed',
      evidence_refs: { legacy_key: 'legacy-value' },
      evidence: {
        command_outputs: ['npm test passed'],
        file_paths: ['src/app.ts'],
        artifact_ids: ['artifact_1'],
        artifact_paths: ['specs/LG-013/integration-report.md'],
        commit_hashes: ['abc123'],
        pr_urls: ['https://github.com/org/repo/pull/1'],
        verification_summaries: ['Integration endpoint returned 200.'],
      },
      risk_level: 'MEDIUM',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.submitClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence_refs: {
          legacy_key: 'legacy-value',
          command_outputs: ['npm test passed'],
          file_paths: ['src/app.ts'],
          artifact_ids: ['artifact_1'],
          artifact_paths: ['specs/LG-013/integration-report.md'],
          commit_hashes: ['abc123'],
          pr_urls: ['https://github.com/org/repo/pull/1'],
          verification_summaries: ['Integration endpoint returned 200.'],
        },
      })
    );
  });

  it('rejects claims from non-watched phases', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-CLAIM', current_phase: '4' })),
      submitClaim: vi.fn(),
    } as unknown as WorkflowStateAdapter;

    const result = await handleSubmitClaim(adapter, {
      feature_id: 'FEAT-CLAIM',
      phase: '4',
      claim_type: 'CODE_MODIFIED',
      description: 'Spec was updated',
      evidence_refs: {},
      risk_level: 'LOW',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('watched phases');
    expect(adapter.submitClaim).not.toHaveBeenCalled();
  });

  it('rejects claims when the provided phase does not match the feature current phase', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-CLAIM', current_phase: '5' })),
      submitClaim: vi.fn(),
    } as unknown as WorkflowStateAdapter;

    const result = await handleSubmitClaim(adapter, {
      feature_id: 'FEAT-CLAIM',
      phase: '7',
      claim_type: 'CODE_MODIFIED',
      description: 'Integration completed',
      evidence_refs: {},
      risk_level: 'LOW',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('currently in phase 5, not 7');
    expect(adapter.submitClaim).not.toHaveBeenCalled();
  });
});
