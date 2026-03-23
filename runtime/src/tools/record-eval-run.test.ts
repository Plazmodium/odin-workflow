import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { handleRecordEvalRun } from './record-eval-run.js';

describe('handleRecordEvalRun', () => {
  it('records a reviewer eval_run artifact with normalized actor name', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-EVAL' })),
      recordPhaseArtifact: vi.fn(async (artifact) => artifact),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordEvalRun(adapter, {
      feature_id: 'FEAT-EVAL',
      phase: '6',
      created_by: 'codex',
      status: 'partial',
      cases_run: ['CAP-1', 'REG-1'],
      important_failures: [],
      manual_review_notes: ['Runtime spot-check still pending.'],
      transcript_review_observations: [],
      follow_up: ['Integrator verifies rendered state.'],
      environment_summary: ['Reviewer executed local test suite.'],
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordPhaseArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_id: 'FEAT-EVAL',
        phase: '6',
        output_type: 'eval_run',
        created_by: 'reviewer-agent',
        content: expect.objectContaining({
          status: 'partial',
          cases_run: ['CAP-1', 'REG-1'],
        }),
      })
    );
    expect(result.structuredContent?.eval_run).toMatchObject({
      status: 'partial',
      phase: '6',
      cases_run: 2,
    });
  });
});
