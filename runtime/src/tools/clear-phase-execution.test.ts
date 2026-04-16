import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { FeatureRecord } from '../types.js';
import { handleClearPhaseExecution } from './clear-phase-execution.js';

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-CLEAR',
    name: 'Clear Execution Feature',
    status: 'IN_PROGRESS',
    current_phase: '5',
    complexity_level: 2,
    severity: 'ROUTINE',
    created_at: '2026-04-16T00:00:00.000Z',
    updated_at: '2026-04-16T00:00:00.000Z',
    ...overrides,
  };
}

describe('handleClearPhaseExecution', () => {
  it('clears the current phase execution attestation', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      clearPhaseExecutionAttestation: vi.fn(async () => undefined),
    } as unknown as WorkflowStateAdapter;

    const result = await handleClearPhaseExecution(adapter, {
      feature_id: 'FEAT-CLEAR',
      phase: '5',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.clearPhaseExecutionAttestation).toHaveBeenCalledWith('FEAT-CLEAR', '5');
  });

  it('rejects attempts to clear historical phase attestations', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature({ current_phase: '6' })),
      clearPhaseExecutionAttestation: vi.fn(async () => undefined),
    } as unknown as WorkflowStateAdapter;

    const result = await handleClearPhaseExecution(adapter, {
      feature_id: 'FEAT-CLEAR',
      phase: '5',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('is currently in phase 6, not 5');
    expect(adapter.clearPhaseExecutionAttestation).not.toHaveBeenCalled();
  });
});
