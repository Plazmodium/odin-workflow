import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { FeatureRecord } from '../types.js';
import { handleRecordReleaseHandoffFailure } from './record-release-handoff-failure.js';

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-RELEASE',
    name: 'Release Feature',
    status: 'IN_PROGRESS',
    current_phase: '9',
    complexity_level: 2,
    severity: 'ROUTINE',
    created_at: '2026-04-02T00:00:00.000Z',
    updated_at: '2026-04-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('handleRecordReleaseHandoffFailure', () => {
  it('closes open release invocations and records failure telemetry', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      listAgentInvocations: vi.fn(async () => [
        {
          id: 'inv_release_open',
          feature_id: 'FEAT-RELEASE',
          phase: '9',
          agent_name: 'ralph-loop',
          operation: 'Phase 9: Release',
          skills_used: [],
          started_at: '2026-04-02T00:00:00.000Z',
          ended_at: null,
          duration_ms: null,
        },
      ]),
      completeAgentInvocation: vi.fn(async () => ({
        id: 'inv_release_open',
        feature_id: 'FEAT-RELEASE',
        phase: '9',
        agent_name: 'ralph-loop',
        operation: 'Phase 9: Release',
        skills_used: [],
        started_at: '2026-04-02T00:00:00.000Z',
        ended_at: '2026-04-02T00:01:00.000Z',
        duration_ms: 60000,
      })),
      recordAuditEvent: vi.fn(async () => undefined),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordReleaseHandoffFailure(adapter, {
      feature_id: 'FEAT-RELEASE',
      summary: 'gh pr create failed',
      created_by: 'ralph-loop',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.completeAgentInvocation).toHaveBeenCalledWith('inv_release_open');
    expect(adapter.recordAuditEvent).toHaveBeenCalledWith(
      'FEAT-RELEASE',
      'RELEASE_HANDOFF_FAILED',
      'ralph-loop',
      expect.objectContaining({ summary: 'gh pr create failed' }),
    );
  });
});
