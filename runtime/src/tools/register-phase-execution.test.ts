import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { FeatureRecord, PhaseExecutionAttestation } from '../types.js';
import { handleRegisterPhaseExecution } from './register-phase-execution.js';

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-EXEC',
    name: 'Execution Feature',
    status: 'IN_PROGRESS',
    current_phase: '5',
    complexity_level: 2,
    severity: 'ROUTINE',
    created_at: '2026-04-16T00:00:00.000Z',
    updated_at: '2026-04-16T00:00:00.000Z',
    ...overrides,
  };
}

describe('handleRegisterPhaseExecution', () => {
  it('returns an error when the feature does not exist', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => null),
      registerPhaseExecution: vi.fn(),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRegisterPhaseExecution(adapter, {
      feature_id: 'MISSING',
      phase: '5',
      actual_mode: 'inline',
      supervisor_session_id: 'ralph-loop:run-1',
      attested_by: 'ralph-loop',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Feature MISSING was not found');
    expect(adapter.registerPhaseExecution).not.toHaveBeenCalled();
  });

  it('returns an error when the requested phase is not the current phase', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature({ current_phase: '6' })),
      registerPhaseExecution: vi.fn(),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRegisterPhaseExecution(adapter, {
      feature_id: 'FEAT-EXEC',
      phase: '5',
      actual_mode: 'inline',
      supervisor_session_id: 'ralph-loop:run-1',
      attested_by: 'ralph-loop',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('is currently in phase 6, not 5');
    expect(adapter.registerPhaseExecution).not.toHaveBeenCalled();
  });

  it('records an attested inline execution row', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      registerPhaseExecution: vi.fn(async (attestation: PhaseExecutionAttestation) => attestation),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRegisterPhaseExecution(adapter, {
      feature_id: 'FEAT-EXEC',
      phase: '5',
      actual_mode: 'inline',
      supervisor_session_id: 'ralph-loop:run-1',
      harness_run_id: 'run-1',
      attested_by: 'ralph-loop',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.registerPhaseExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_id: 'FEAT-EXEC',
        phase: '5',
        actual_mode: 'inline',
        execution_policy: 'distinct_session_preferred',
        recommended_mode: 'subagent',
        proof_status: 'attested',
        supervisor_session_id: 'ralph-loop:run-1',
        worker_session_id: 'ralph-loop:run-1',
        attested_by: 'ralph-loop',
      })
    );
  });

  it('records an attested subagent execution row with a distinct worker session', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      registerPhaseExecution: vi.fn(async (attestation: PhaseExecutionAttestation) => attestation),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRegisterPhaseExecution(adapter, {
      feature_id: 'FEAT-EXEC',
      phase: '5',
      actual_mode: 'subagent',
      supervisor_session_id: 'ralph-loop:run-1',
      worker_session_id: 'worker-agent:session-2',
      harness_run_id: 'run-1',
      attested_by: 'ralph-loop',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.registerPhaseExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_id: 'FEAT-EXEC',
        phase: '5',
        actual_mode: 'subagent',
        execution_policy: 'distinct_session_preferred',
        recommended_mode: 'subagent',
        proof_status: 'attested',
        supervisor_session_id: 'ralph-loop:run-1',
        worker_session_id: 'worker-agent:session-2',
        attested_by: 'ralph-loop',
      })
    );
  });

  it('rejects inline attestation when worker_session_id differs from supervisor_session_id', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      registerPhaseExecution: vi.fn(),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRegisterPhaseExecution(adapter, {
      feature_id: 'FEAT-EXEC',
      phase: '5',
      actual_mode: 'inline',
      supervisor_session_id: 'ralph-loop:run-1',
      worker_session_id: 'worker-agent:session-2',
      harness_run_id: 'run-1',
      attested_by: 'ralph-loop',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('worker_session_id must be omitted or match supervisor_session_id');
    expect(adapter.registerPhaseExecution).not.toHaveBeenCalled();
  });

  it('rejects subagent attestation without a distinct worker session id', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      registerPhaseExecution: vi.fn(),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRegisterPhaseExecution(adapter, {
      feature_id: 'FEAT-EXEC',
      phase: '5',
      actual_mode: 'subagent',
      supervisor_session_id: 'ralph-loop:run-1',
      harness_run_id: 'run-1',
      attested_by: 'ralph-loop',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('worker_session_id is required when actual_mode is subagent');
    expect(adapter.registerPhaseExecution).not.toHaveBeenCalled();
  });

  it('rejects subagent attestation when worker_session_id matches supervisor_session_id', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      registerPhaseExecution: vi.fn(),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRegisterPhaseExecution(adapter, {
      feature_id: 'FEAT-EXEC',
      phase: '5',
      actual_mode: 'subagent',
      supervisor_session_id: 'ralph-loop:run-1',
      worker_session_id: 'ralph-loop:run-1',
      harness_run_id: 'run-1',
      attested_by: 'ralph-loop',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('worker_session_id must differ from supervisor_session_id');
    expect(adapter.registerPhaseExecution).not.toHaveBeenCalled();
  });
});
