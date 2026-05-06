import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import type { AgentClaimRecord, PhaseExecutionAttestation } from '../types.js';
import { handleRecordWatcherReview } from './record-watcher-review.js';

function createConfig(mode: 'advisory' | 'strict' = 'advisory'): RuntimeConfig {
  return {
    runtime: { mode: 'in_memory' },
    attestation: {
      mode,
      require_execution_phases: ['5', '6', '7', '9'],
      require_prompt_realization_phases: ['5', '6', '7', '9'],
    },
  };
}

function createClaim(): AgentClaimRecord {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    feature_id: 'FEAT-WATCH',
    phase: '5',
    agent_name: 'builder-agent',
    invocation_id: null,
    claim_type: 'CODE_MODIFIED',
    claim_description: 'Changed code',
    evidence_refs: {},
    risk_level: 'HIGH',
    created_at: '2026-03-20T16:00:00.000Z',
  };
}

function createExecution(): PhaseExecutionAttestation {
  return {
    feature_id: 'FEAT-WATCH',
    phase: '5',
    execution_policy: 'distinct_session_preferred',
    recommended_mode: 'subagent',
    actual_mode: 'subagent',
    proof_status: 'attested',
    supervisor_session_id: 'supervisor-session',
    worker_session_id: 'worker-session',
    harness_run_id: 'run-1',
    attested_by: 'ralph-loop',
    attestation_source: 'harness',
    recorded_at: '2026-03-20T16:02:00.000Z',
  };
}

describe('handleRecordWatcherReview', () => {
  it('normalizes harness labels to watcher-agent', async () => {
    const adapter: WorkflowStateAdapter = {
      getClaim: vi.fn(async () => createClaim()),
      getPhaseExecutionAttestation: vi.fn(async () => createExecution()),
      recordWatcherReview: vi.fn(async (review) => ({
        id: 'review_1',
        reviewed_at: '2026-03-20T16:15:00.000Z',
        ...review,
      })),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordWatcherReview(adapter, createConfig(), {
      claim_id: '550e8400-e29b-41d4-a716-446655440000',
      verdict: 'PASS',
      reasoning: 'Claim matches the supplied evidence.',
      watcher_agent: 'opencode',
      watcher_session_id: 'watcher-session',
      confidence: 0.91,
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordWatcherReview).toHaveBeenCalledWith({
      claim_id: '550e8400-e29b-41d4-a716-446655440000',
      verdict: 'PASS',
      confidence: 0.91,
      reasoning: 'Claim matches the supplied evidence.',
      watcher_agent: 'watcher-agent',
      watcher_session_id: 'watcher-session',
      trust_level: 'independent',
      independence_override_reason: null,
    });
  });

  it('blocks self-review PASS in strict mode unless override is supplied', async () => {
    const adapter: WorkflowStateAdapter = {
      getClaim: vi.fn(async () => createClaim()),
      getPhaseExecutionAttestation: vi.fn(async () => createExecution()),
      recordWatcherReview: vi.fn(async (review) => ({
        id: 'review_1',
        reviewed_at: '2026-03-20T16:15:00.000Z',
        ...review,
      })),
    } as unknown as WorkflowStateAdapter;

    const blocked = await handleRecordWatcherReview(adapter, createConfig('strict'), {
      claim_id: '550e8400-e29b-41d4-a716-446655440000',
      verdict: 'PASS',
      reasoning: 'Claim matches the supplied evidence.',
      watcher_agent: 'watcher-agent',
      watcher_session_id: 'worker-session',
      confidence: 0.91,
    });

    expect(blocked.isError).toBe(true);
    expect(blocked.content[0]?.text).toContain('requires a distinct watcher session');
    expect(adapter.recordWatcherReview).not.toHaveBeenCalled();

    const overridden = await handleRecordWatcherReview(adapter, createConfig('strict'), {
      claim_id: '550e8400-e29b-41d4-a716-446655440000',
      verdict: 'PASS',
      reasoning: 'Claim matches the supplied evidence.',
      watcher_agent: 'watcher-agent',
      watcher_session_id: 'worker-session',
      independence_override_reason: 'Independent watcher session was unavailable during incident response.',
      confidence: 0.91,
    });

    expect(overridden.isError).toBeUndefined();
    expect(overridden.content[0]?.text).toContain('Override accepted');
    expect(adapter.recordWatcherReview).toHaveBeenCalledWith(
      expect.objectContaining({
        trust_level: 'override',
        independence_override_reason: 'Independent watcher session was unavailable during incident response.',
      })
    );
  });

  it('marks advisory PASS without session as self-review warning', async () => {
    const adapter: WorkflowStateAdapter = {
      getClaim: vi.fn(async () => createClaim()),
      getPhaseExecutionAttestation: vi.fn(async () => createExecution()),
      recordWatcherReview: vi.fn(async (review) => ({
        id: 'review_1',
        reviewed_at: '2026-03-20T16:15:00.000Z',
        ...review,
      })),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordWatcherReview(adapter, createConfig(), {
      claim_id: '550e8400-e29b-41d4-a716-446655440000',
      verdict: 'PASS',
      reasoning: 'Claim matches the supplied evidence.',
      watcher_agent: 'watcher-agent',
      confidence: 0.91,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Warning:');
    expect(adapter.recordWatcherReview).toHaveBeenCalledWith(
      expect.objectContaining({
        watcher_session_id: null,
        trust_level: 'self_review',
      })
    );
  });
});
