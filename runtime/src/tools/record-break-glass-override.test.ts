import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { handleRecordBreakGlassOverride } from './record-break-glass-override.js';

describe('handleRecordBreakGlassOverride', () => {
  it('records an audit event and creates a rejected follow-up gate', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-BREAK', current_phase: '5' })),
      recordAuditEvent: vi.fn(async () => undefined),
      recordQualityGate: vi.fn(async () => 42),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordBreakGlassOverride(adapter, {
      feature_id: 'FEAT-BREAK',
      phase: '5',
      reason: 'Emergency production fix.',
      missing_proof: ['execution_attestation'],
      created_by: 'opencode',
      follow_up: 'Re-run with builder subagent proof.',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordAuditEvent).toHaveBeenCalledWith(
      'FEAT-BREAK',
      'BREAK_GLASS_OVERRIDE_RECORDED',
      'builder-agent',
      expect.objectContaining({ reason: 'Emergency production fix.' }),
    );
    expect(adapter.recordQualityGate).toHaveBeenCalledWith(
      'FEAT-BREAK',
      'break_glass_follow_up_phase_5',
      'REJECTED',
      'builder-agent',
      'Re-run with builder subagent proof.',
      '5',
    );
  });
});
