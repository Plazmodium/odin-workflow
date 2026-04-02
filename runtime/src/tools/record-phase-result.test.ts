import { describe, expect, it, vi } from 'vitest';

import type { ArchiveAdapter } from '../adapters/archive/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { FeatureRecord, PhaseArtifact, PhaseResultRecord } from '../types.js';
import { handleRecordPhaseResult } from './record-phase-result.js';

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-RESULT',
    name: 'Result Feature',
    status: 'IN_PROGRESS',
    current_phase: '5',
    complexity_level: 2,
    severity: 'ROUTINE',
    author: 'Jane Doe',
    created_at: '2026-03-20T00:00:00.000Z',
    updated_at: '2026-03-20T00:00:00.000Z',
    ...overrides,
  };
}

function createTasksArtifact(content: unknown): PhaseArtifact {
  return {
    id: 'artifact_tasks',
    feature_id: 'FEAT-RESULT',
    phase: '3',
    output_type: 'tasks',
    content,
    created_by: 'architect-agent',
    created_at: '2026-03-20T00:00:00.000Z',
  };
}

describe('handleRecordPhaseResult', () => {
  it('normalizes harness actors, completes open invocations, and auto-completes remaining Builder tasks', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      listPhaseArtifacts: vi.fn(async () => [
        createTasksArtifact([{ id: 'T1', title: 'Add tests', status: 'pending' }]),
      ]),
      recordPhaseArtifact: vi.fn(async (artifact: PhaseArtifact) => artifact),
      findOpenAgentInvocation: vi.fn(async () => ({
        id: 'inv_open',
        feature_id: 'FEAT-RESULT',
        phase: '5',
        agent_name: 'builder-agent',
        operation: 'Phase 5: Builder',
        skills_used: ['testing/unit-tests-sdd'],
        started_at: '2026-03-20T00:00:00.000Z',
        ended_at: null,
        duration_ms: null,
      })),
      completeAgentInvocation: vi.fn(async () => ({
        id: 'inv_open',
        feature_id: 'FEAT-RESULT',
        phase: '5',
        agent_name: 'builder-agent',
        operation: 'Phase 5: Builder',
        skills_used: ['testing/unit-tests-sdd'],
        started_at: '2026-03-20T00:00:00.000Z',
        ended_at: '2026-03-20T00:05:00.000Z',
        duration_ms: 300000,
      })),
      recordPhaseResult: vi.fn(async (result: PhaseResultRecord) => createFeature({ current_phase: result.next_phase ?? '6' })),
      recordQualityGate: vi.fn(async () => 1),
      computeFeatureEval: vi.fn(async () => null),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPhaseResult(adapter, null, {
      feature_id: 'FEAT-RESULT',
      phase: '5',
      outcome: 'completed',
      summary: 'Builder finished implementation',
      created_by: 'opencode',
      blockers: [],
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordPhaseArtifact).toHaveBeenCalledTimes(1);
    expect(adapter.recordPhaseArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_id: 'FEAT-RESULT',
        phase: '3',
        created_by: 'builder-agent',
        content: [{ id: 'T1', title: 'Add tests', status: 'completed' }],
      })
    );
    expect(adapter.recordPhaseResult).toHaveBeenCalledWith(
      expect.objectContaining({
        created_by: 'builder-agent',
      })
    );
    expect(adapter.completeAgentInvocation).toHaveBeenCalledWith('inv_open');
    expect(adapter.recordQualityGate).toHaveBeenCalledWith(
      'FEAT-RESULT',
      'builder_phase_complete',
      'APPROVED',
      'builder-agent',
      'Builder finished implementation',
      '5'
    );
  });

  it('blocks Release completion until a merge is recorded', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature({ current_phase: '9' })),
      listPhaseArtifacts: vi.fn(async () => []),
      recordPhaseResult: vi.fn(),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPhaseResult(adapter, null, {
      feature_id: 'FEAT-RESULT',
      phase: '9',
      outcome: 'completed',
      next_phase: '10',
      summary: 'Release finished, ready to close',
      created_by: 'opencode',
      blockers: [],
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('cannot complete Release until a merge has been recorded');
    expect(adapter.recordPhaseResult).not.toHaveBeenCalled();
  });

  it('uses the runtime-owned completion flow when Release closes after merge', async () => {
    const archive_adapter: ArchiveAdapter = {
      uploadArchive: vi.fn(),
      recordArchive: vi.fn(),
      listArchives: vi.fn(async () => []),
    } as unknown as ArchiveAdapter;
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () =>
        createFeature({
          current_phase: '9',
          merged_at: '2026-03-20T01:00:00.000Z',
          pr_url: 'https://github.com/org/repo/pull/42',
          pr_number: 42,
        })
      ),
      listPhaseArtifacts: vi.fn(async () => []),
      findOpenAgentInvocation: vi.fn(async () => ({
        id: 'inv_release',
        feature_id: 'FEAT-RESULT',
        phase: '9',
        agent_name: 'release-agent',
        operation: 'Phase 9: Release',
        skills_used: [],
        started_at: '2026-03-20T00:00:00.000Z',
        ended_at: null,
        duration_ms: null,
      })),
      completeAgentInvocation: vi.fn(async () => ({
        id: 'inv_release',
        feature_id: 'FEAT-RESULT',
        phase: '9',
        agent_name: 'release-agent',
        operation: 'Phase 9: Release',
        skills_used: [],
        started_at: '2026-03-20T00:00:00.000Z',
        ended_at: '2026-03-20T00:05:00.000Z',
        duration_ms: 300000,
      })),
      recordPhaseResult: vi.fn(async () =>
        createFeature({
          status: 'COMPLETED',
          current_phase: '10',
          merged_at: '2026-03-20T01:00:00.000Z',
          completed_at: '2026-03-20T01:05:00.000Z',
        })
      ),
      recordQualityGate: vi.fn(async () => 1),
      getLatestFeatureEval: vi.fn(async () => ({
        id: 'eval_release',
        feature_id: 'FEAT-RESULT',
        computed_at: '2026-03-20T01:05:00.000Z',
        efficiency_score: 95,
        quality_score: 97,
        overall_score: 96,
        health_status: 'HEALTHY',
      })),
      computeFeatureEval: vi.fn(async () => null),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPhaseResult(adapter, archive_adapter, {
      feature_id: 'FEAT-RESULT',
      phase: '9',
      outcome: 'completed',
      next_phase: '10',
      summary: 'Release finished after merge',
      created_by: 'opencode',
      blockers: [],
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordPhaseResult).toHaveBeenCalledWith(
      expect.objectContaining({
        created_by: 'release-agent',
        next_phase: '10',
      })
    );
    expect(
      (adapter.completeAgentInvocation as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    ).toBeLessThan((adapter.recordPhaseResult as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]);
    expect(adapter.getLatestFeatureEval).toHaveBeenCalledWith('FEAT-RESULT');
    expect(adapter.computeFeatureEval).not.toHaveBeenCalled();
    expect(archive_adapter.uploadArchive).not.toHaveBeenCalled();
    expect(result.structuredContent?.feature_eval).toMatchObject({
      id: 'eval_release',
    });
  });
});
