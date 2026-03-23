import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { FeatureRecord, PhaseArtifact, QualityGateRecord } from '../types.js';
import { handleGetDevelopmentEvalStatus } from './get-development-eval-status.js';

function createFeature(): FeatureRecord {
  return {
    id: 'FEAT-EVAL-STATUS',
    name: 'Eval Status Feature',
    status: 'IN_PROGRESS',
    current_phase: '6',
    complexity_level: 2,
    severity: 'ROUTINE',
    author: 'Jane Doe',
    created_at: '2026-03-23T00:00:00.000Z',
    updated_at: '2026-03-23T00:00:00.000Z',
  };
}

const artifacts: PhaseArtifact[] = [
  {
    id: 'artifact_plan',
    feature_id: 'FEAT-EVAL-STATUS',
    phase: '3',
    output_type: 'eval_plan',
    content: { scope: 'Track eval state' },
    created_by: 'architect-agent',
    created_at: '2026-03-23T01:00:00.000Z',
  },
  {
    id: 'artifact_run_old',
    feature_id: 'FEAT-EVAL-STATUS',
    phase: '6',
    output_type: 'eval_run',
    content: { status: 'partial' },
    created_by: 'reviewer-agent',
    created_at: '2026-03-23T02:00:00.000Z',
  },
  {
    id: 'artifact_run_new',
    feature_id: 'FEAT-EVAL-STATUS',
    phase: '7',
    output_type: 'eval_run',
    content: { status: 'passed' },
    created_by: 'integrator-agent',
    created_at: '2026-03-23T03:00:00.000Z',
  },
];

const gates: QualityGateRecord[] = [
  {
    id: 1,
    feature_id: 'FEAT-EVAL-STATUS',
    gate_name: 'eval_readiness',
    phase: '4',
    status: 'REJECTED',
    approver: 'guardian-agent',
    approved_at: '2026-03-23T01:30:00.000Z',
    approval_notes: 'First draft was weak.',
  },
  {
    id: 2,
    feature_id: 'FEAT-EVAL-STATUS',
    gate_name: 'eval_readiness',
    phase: '4',
    status: 'PENDING',
    approver: 'guardian-agent',
    approved_at: '2026-03-23T04:00:00.000Z',
    approval_notes: 'Waiting on follow-up review.',
  },
];

describe('handleGetDevelopmentEvalStatus', () => {
  it('returns focused development eval status and recent history', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      listPhaseArtifacts: vi.fn(async () => artifacts),
      listOpenGateRecords: vi.fn(async () => gates),
    } as unknown as WorkflowStateAdapter;

    const result = await handleGetDevelopmentEvalStatus(adapter, {
      feature_id: 'FEAT-EVAL-STATUS',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Development eval mode is plan_required.');
    expect(result.content[0]?.text).toContain('Latest eval_run recorded.');
    expect(result.structuredContent?.development_evals).toMatchObject({
      mode: 'plan_required',
      latest_plan: {
        output_type: 'eval_plan',
      },
      latest_run: {
        created_by: 'integrator-agent',
      },
      open_readiness_gate: {
        status: 'PENDING',
      },
    });
    expect(result.structuredContent?.history).toMatchObject({
      eval_plan_count: 1,
      eval_run_count: 2,
    });
  });
});
