import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { handleRecordEvalPlan } from './record-eval-plan.js';

describe('handleRecordEvalPlan', () => {
  it('records an architect-scoped eval_plan artifact', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-EVAL' })),
      recordPhaseArtifact: vi.fn(async (artifact) => artifact),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordEvalPlan(adapter, {
      feature_id: 'FEAT-EVAL',
      created_by: 'opencode',
      scope: 'Profile updates behave correctly.',
      success_criteria: ['Authenticated update persists values.'],
      non_goals: ['Editing another user profile.'],
      capability_evals: [
        {
          id: 'CAP-1',
          expected_outcome: 'Profile update succeeds.',
          grader_type: 'tests',
          pass_rule: 'Endpoint returns saved values.',
        },
      ],
      regression_evals: [],
      transcript_review_plan: ['Inspect failed cases and sample one pass.'],
      solvability_note: 'Existing auth/profile path already exists.',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordPhaseArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_id: 'FEAT-EVAL',
        phase: '3',
        output_type: 'eval_plan',
        created_by: 'architect-agent',
        content: expect.objectContaining({
          scope: 'Profile updates behave correctly.',
          capability_evals: expect.arrayContaining([expect.objectContaining({ id: 'CAP-1' })]),
        }),
      })
    );
  });
});
