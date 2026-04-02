import { describe, expect, it } from 'vitest';

import type { AutomationDecision, FeatureRecord } from '../types.js';
import { deriveAutonomyFeatureState, pickAutonomousQueueEntry } from './autonomous-pickup.js';

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-AUTO',
    name: 'Autonomous Feature',
    status: 'IN_PROGRESS',
    current_phase: '5',
    complexity_level: 2,
    severity: 'ROUTINE',
    base_branch: 'main',
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function createAutomation(overrides: Partial<AutomationDecision> = {}): AutomationDecision {
  return {
    configured_mode: 'guarded',
    effective_mode: 'guarded',
    paused: false,
    kill_switch_active: false,
    base_branch: 'main',
    allowed_base_branch: true,
    capabilities: {
      can_open_pr: false,
      can_update_pr: false,
      can_merge: false,
      can_continue_without_human_prompt: false,
    },
    blocking_reasons: ['automation.mode is guarded; human approval is required before PR creation'],
    next_human_boundary: 'pr',
    preconditions: {
      open_blockers: 0,
      open_gates: 0,
      open_findings: 0,
      pending_claims: 0,
      claims_needing_review: 0,
      claim_verification: {
        total: 0,
        passed: 0,
        failed: 0,
        needs_review: 0,
        pending: 0,
      },
    },
    ...overrides,
  };
}

describe('deriveAutonomyFeatureState', () => {
  it('treats non-release in-progress work as ready even in guarded mode', () => {
    const state = deriveAutonomyFeatureState({
      feature: createFeature({ current_phase: '5' }),
      automation: createAutomation(),
      open_blockers: [],
      open_gate_records: [],
      open_findings: [],
      pending_claims: [],
      claims_needing_review_count: 0,
      has_open_invocation: false,
    });

    expect(state).toMatchObject({
      status: 'ready_for_phase',
      can_pick_now: true,
      selection_reason: 'ready_for_phase',
    });
  });

  it('waits for a human PR when Release has no PR and automation cannot open one', () => {
    const state = deriveAutonomyFeatureState({
      feature: createFeature({ current_phase: '9' }),
      automation: createAutomation(),
      open_blockers: [],
      open_gate_records: [],
      open_findings: [],
      pending_claims: [],
      claims_needing_review_count: 0,
      has_open_invocation: false,
    });

    expect(state).toMatchObject({
      status: 'waiting_on_human_pr',
      can_pick_now: false,
    });
  });

  it('marks merged release work as ready to close', () => {
    const state = deriveAutonomyFeatureState({
      feature: createFeature({ current_phase: '9', pr_url: 'https://github.com/org/repo/pull/42', pr_number: 42, merged_at: '2026-04-02T00:00:00.000Z' }),
      automation: createAutomation({
        configured_mode: 'auto_pr',
        effective_mode: 'auto_pr',
        capabilities: {
          can_open_pr: true,
          can_update_pr: true,
          can_merge: false,
          can_continue_without_human_prompt: true,
        },
        blocking_reasons: [],
        next_human_boundary: 'merge',
      }),
      open_blockers: [],
      open_gate_records: [],
      open_findings: [],
      pending_claims: [],
      claims_needing_review_count: 0,
      has_open_invocation: false,
    });

    expect(state).toMatchObject({
      status: 'ready_for_phase',
      can_pick_now: true,
      selection_reason: 'merged_and_ready_to_close_release',
    });
  });
});

describe('pickAutonomousQueueEntry', () => {
  it('prioritizes merged release closeout over earlier ready work', () => {
    const queued = pickAutonomousQueueEntry([
      {
        feature: createFeature({ id: 'FEAT-BUILD', current_phase: '5', severity: 'CRITICAL' }),
        automation: createAutomation(),
        state: {
          status: 'ready_for_phase',
          detail: 'Builder is ready.',
          can_pick_now: true,
          selection_reason: 'ready_for_phase',
        },
      },
      {
        feature: createFeature({
          id: 'FEAT-RELEASE',
          current_phase: '9',
          pr_url: 'https://github.com/org/repo/pull/42',
          pr_number: 42,
          merged_at: '2026-04-02T00:00:00.000Z',
        }),
        automation: createAutomation(),
        state: {
          status: 'ready_for_phase',
          detail: 'Release can close the feature.',
          can_pick_now: true,
          selection_reason: 'merged_and_ready_to_close_release',
        },
      },
    ]);

    expect(queued?.feature.id).toBe('FEAT-RELEASE');
  });
});
