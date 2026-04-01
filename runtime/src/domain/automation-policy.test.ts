import { describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '../config.js';
import type { FeatureRecord } from '../types.js';
import { resolveAutomationDecision } from './automation-policy.js';

function createFeature(base_branch = 'main'): FeatureRecord {
  return {
    id: 'FEAT-AUTO',
    name: 'Automation Feature',
    status: 'IN_PROGRESS',
    current_phase: '9',
    complexity_level: 2,
    severity: 'ROUTINE',
    base_branch,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
  };
}

function createConfig(mode: 'guarded' | 'auto_pr'): RuntimeConfig {
  return {
    runtime: { mode: 'in_memory' },
    automation: {
      mode,
      allowed_base_branches: ['main'],
      require_green_checks: true,
      require_clean_policy_checks: true,
      require_no_open_blockers: true,
      require_watched_claims_verified: true,
      paused: false,
      kill_switch: false,
      merge_strategy: 'squash',
    },
  };
}

describe('resolveAutomationDecision', () => {
  it('keeps guarded mode as a human PR boundary', () => {
    const decision = resolveAutomationDecision({
      config: createConfig('guarded'),
      feature: createFeature(),
      open_blockers: [],
      open_gate_records: [],
      open_findings: [],
      pending_claims: [],
      claim_verification: [],
      claims_needing_review_count: 0,
    });

    expect(decision.capabilities.can_open_pr).toBe(false);
    expect(decision.next_human_boundary).toBe('pr');
    expect(decision.blocking_reasons).toContain(
      'automation.mode is guarded; human approval is required before PR creation'
    );
  });

  it('allows autonomous PR actions in auto_pr mode when preconditions pass', () => {
    const decision = resolveAutomationDecision({
      config: createConfig('auto_pr'),
      feature: createFeature(),
      open_blockers: [],
      open_gate_records: [],
      open_findings: [],
      pending_claims: [],
      claim_verification: [],
      claims_needing_review_count: 0,
    });

    expect(decision.capabilities.can_open_pr).toBe(true);
    expect(decision.capabilities.can_update_pr).toBe(true);
    expect(decision.capabilities.can_merge).toBe(false);
    expect(decision.blocking_reasons).toEqual([]);
    expect(decision.next_human_boundary).toBe('merge');
  });

  it('blocks auto_pr mode when the base branch is not allowlisted or claims need review', () => {
    const decision = resolveAutomationDecision({
      config: createConfig('auto_pr'),
      feature: createFeature('dev'),
      open_blockers: [],
      open_gate_records: [],
      open_findings: [],
      pending_claims: ['CODE_MODIFIED by builder-agent (NEEDS_REVIEW)'],
      claim_verification: [
        {
          claim_id: 'claim_1',
          claim_type: 'CODE_MODIFIED',
          agent_name: 'builder-agent',
          risk_level: 'LOW',
          policy_verdict: 'NEEDS_REVIEW',
          watcher_verdict: null,
          final_status: 'NEEDS_REVIEW',
        },
      ],
      claims_needing_review_count: 1,
    });

    expect(decision.capabilities.can_open_pr).toBe(false);
    expect(decision.blocking_reasons).toContain('base branch "dev" is not allowlisted for autonomous PR actions');
    expect(decision.blocking_reasons).toContain('1 claim(s) still need policy resolution');
    expect(decision.blocking_reasons).toContain('1 claim(s) still need watcher review');
  });
});
