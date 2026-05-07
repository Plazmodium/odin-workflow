import { describe, expect, it, vi } from 'vitest';

import type { ReviewAdapter } from '../adapters/review/types.js';
import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import { handleRunReviewChecks } from './run-review-checks.js';

function createStrictConfig(): RuntimeConfig {
  return {
    runtime: { mode: 'in_memory' },
    automation: {
      mode: 'guarded',
      allowed_base_branches: ['main'],
      require_green_checks: true,
      require_clean_policy_checks: true,
      require_no_open_blockers: true,
      require_watched_claims_verified: true,
      paused: false,
      kill_switch: false,
      merge_strategy: 'squash',
    },
    attestation: {
      mode: 'strict',
      require_execution_phases: ['5', '6', '7', '9'],
      require_prompt_realization_phases: ['5', '6', '7', '9'],
    },
  };
}

function createSkillAdapter(): SkillAdapter {
  return {
    resolveSkills: vi.fn(async () => ({ resolved: [], fallback_used: false })),
    listKnowledgeDomains: vi.fn(async () => []),
    invalidateCaches: vi.fn(),
  };
}

describe('handleRunReviewChecks', () => {
  it('fails closed in strict mode when skill adapter is unavailable', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(),
      recordReviewCheck: vi.fn(),
    } as unknown as WorkflowStateAdapter;
    const reviewAdapter: ReviewAdapter = {
      runChecks: vi.fn(async () => ({ tool: 'semgrep', status: 'passed', summary: 'ok', changed_files: [], findings: [] })),
    };

    const result = await handleRunReviewChecks(adapter, reviewAdapter, {
      feature_id: 'FEAT-REVIEW',
      phase: '6',
      tool: 'semgrep',
      changed_files: [],
      initiated_by: 'opencode',
    }, undefined, createStrictConfig());

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Strict attestation mode requires skill_adapter');
    expect(adapter.getFeature).not.toHaveBeenCalled();
    expect(reviewAdapter.runChecks).not.toHaveBeenCalled();
  });

  it('blocks strict review checks before phase-agent prework is proven', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({
        id: 'FEAT-REVIEW',
        name: 'Review Feature',
        status: 'IN_PROGRESS',
        current_phase: '6',
        complexity_level: 2,
        severity: 'ROUTINE',
        created_at: '2026-03-20T00:00:00.000Z',
        updated_at: '2026-03-20T00:00:00.000Z',
      })),
      recordReviewCheck: vi.fn(),
      listPhaseArtifacts: vi.fn(async () => []),
      listLearnings: vi.fn(async () => []),
      listRelatedLearnings: vi.fn(async () => []),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGateRecords: vi.fn(async () => []),
      listOpenFindings: vi.fn(async () => []),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => []),
      listClaimsNeedingReview: vi.fn(async () => []),
      getPhaseExecutionAttestation: vi.fn(async () => null),
      getPhasePromptRealization: vi.fn(async () => null),
    } as unknown as WorkflowStateAdapter;
    const reviewAdapter: ReviewAdapter = {
      runChecks: vi.fn(async () => ({ tool: 'semgrep', status: 'passed', summary: 'ok', changed_files: [], findings: [] })),
    };

    const result = await handleRunReviewChecks(adapter, reviewAdapter, {
      feature_id: 'FEAT-REVIEW',
      phase: '6',
      tool: 'semgrep',
      changed_files: [],
      initiated_by: 'opencode',
    }, createSkillAdapter(), createStrictConfig());

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('before canonical phase-agent execution is proven');
    expect(reviewAdapter.runChecks).not.toHaveBeenCalled();
  });
});
