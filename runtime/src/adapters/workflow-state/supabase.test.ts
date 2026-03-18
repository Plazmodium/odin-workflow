import { describe, expect, it } from 'vitest';

import { shouldTransitionPhaseResult } from './supabase.js';

describe('shouldTransitionPhaseResult', () => {
  it('transitions completed results when next phase differs', () => {
    expect(
      shouldTransitionPhaseResult({
        id: 'result_1',
        feature_id: 'FEAT-001',
        phase: '1',
        outcome: 'completed',
        summary: 'done',
        next_phase: '2',
        blockers: [],
        created_by: 'tester',
        created_at: '2026-03-13T00:00:00.000Z',
      })
    ).toBe(true);
  });

  it('transitions needs_rework results when next phase differs', () => {
    expect(
      shouldTransitionPhaseResult({
        id: 'result_2',
        feature_id: 'FEAT-001',
        phase: '5',
        outcome: 'needs_rework',
        summary: 'go back',
        next_phase: '4',
        blockers: [],
        created_by: 'tester',
        created_at: '2026-03-13T00:00:00.000Z',
      })
    ).toBe(true);
  });

  it('does not transition blocked results', () => {
    expect(
      shouldTransitionPhaseResult({
        id: 'result_3',
        feature_id: 'FEAT-001',
        phase: '6',
        outcome: 'blocked',
        summary: 'blocked',
        next_phase: '7',
        blockers: ['Needs decision'],
        created_by: 'tester',
        created_at: '2026-03-13T00:00:00.000Z',
      })
    ).toBe(false);
  });
});
