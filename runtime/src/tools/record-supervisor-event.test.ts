import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { handleRecordSupervisorEvent } from './record-supervisor-event.js';

describe('handleRecordSupervisorEvent', () => {
  it('records nullable feature events into audit telemetry', async () => {
    const adapter: WorkflowStateAdapter = {
      recordAuditEvent: vi.fn(async () => undefined),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordSupervisorEvent(adapter, {
      supervisor_name: 'ralph-loop',
      event_type: 'tick_noop',
      summary: 'No autonomous phase is eligible right now.',
      feature_id: null,
      details: {
        reason: 'waiting on human merge',
      },
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordAuditEvent).toHaveBeenCalledWith(
      null,
      'SUPERVISOR_TICK_NOOP',
      'ralph-loop',
      {
        summary: 'No autonomous phase is eligible right now.',
        reason: 'waiting on human merge',
      },
    );
  });
});
