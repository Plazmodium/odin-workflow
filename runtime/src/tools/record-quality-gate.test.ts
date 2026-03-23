import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { handleRecordQualityGate } from './record-quality-gate.js';

describe('handleRecordQualityGate', () => {
  it('records a quality gate decision for an existing feature', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-GATE' })),
      recordQualityGate: vi.fn(async () => 42),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordQualityGate(adapter, {
      feature_id: 'FEAT-GATE',
      gate_name: 'eval_readiness',
      status: 'APPROVED',
      approver: 'guardian-agent',
      notes: 'Eval plan is adequate for build.',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordQualityGate).toHaveBeenCalledWith(
      'FEAT-GATE',
      'eval_readiness',
      'APPROVED',
      'guardian-agent',
      'Eval plan is adequate for build.',
      undefined
    );
    expect(result.structuredContent?.gate).toMatchObject({
      id: 42,
      gate_name: 'eval_readiness',
      status: 'APPROVED',
    });
  });
});
