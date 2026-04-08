import { describe, expect, it, vi } from 'vitest';

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import type { FeatureRecord } from '../types.js';
import { handlePickNextAutonomousPhase } from './pick-next-autonomous-phase.js';

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

function createSkillAdapter(): SkillAdapter {
  return {
    resolveSkills: vi.fn(async () => ({ resolved: [], fallback_used: false })),
    listKnowledgeDomains: vi.fn(async () => []),
    invalidateCaches: vi.fn(),
  };
}

describe('handlePickNextAutonomousPhase', () => {
  it('selects the next eligible feature and returns prepared context', async () => {
    const features = [
      createFeature({ id: 'FEAT-RUN', name: 'Run Me', current_phase: '5', severity: 'EXPEDITED' }),
      createFeature({
        id: 'FEAT-WAIT',
        name: 'Wait for Merge',
        current_phase: '9',
        pr_url: 'https://github.com/org/repo/pull/42',
        pr_number: 42,
        severity: 'CRITICAL',
      }),
    ];
    const by_id = new Map(features.map((feature) => [feature.id, feature]));
    const adapter: WorkflowStateAdapter = {
      startFeature: vi.fn(),
      getFeature: vi.fn(async (feature_id: string) => by_id.get(feature_id) ?? null),
      listFeatures: vi.fn(async () => features),
      recordPhaseArtifact: vi.fn(),
      listPhaseArtifacts: vi.fn(async () => []),
      recordPhaseResult: vi.fn(),
      completeFeature: vi.fn(),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGates: vi.fn(async () => []),
      listOpenGateRecords: vi.fn(async () => []),
      listOpenFindings: vi.fn(async () => []),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => []),
      submitClaim: vi.fn(),
      runPolicyChecks: vi.fn(),
      listClaimsNeedingReview: vi.fn(async () => []),
      recordWatcherReview: vi.fn(),
      getLatestFeatureEval: vi.fn(async () => null),
      recordReviewCheck: vi.fn(),
      listReviewChecks: vi.fn(async () => []),
      captureLearning: vi.fn(),
      listLearnings: vi.fn(async () => []),
      listAgentInvocations: vi.fn(async (feature_id: string) =>
        feature_id === 'FEAT-WAIT'
          ? [
              {
                id: 'inv_complete_release',
                feature_id: 'FEAT-WAIT',
                phase: '9',
                agent_name: 'release-agent',
                operation: 'Phase 9: Release',
                skills_used: [],
                started_at: '2026-04-01T00:00:00.000Z',
                ended_at: '2026-04-01T00:05:00.000Z',
                duration_ms: 300000,
              },
            ]
          : []
      ),
      findOpenAgentInvocation: vi.fn(async () => null),
      startAgentInvocation: vi.fn(async (feature_id: string, phase: FeatureRecord['current_phase'], agent_name: string) => ({
        id: `inv_${feature_id}`,
        feature_id,
        phase,
        agent_name,
        operation: `Phase ${phase}`,
        skills_used: [],
        started_at: '2026-04-01T00:10:00.000Z',
        ended_at: null,
        duration_ms: null,
      })),
      completeAgentInvocation: vi.fn(),
      recordCommit: vi.fn(),
      recordPullRequest: vi.fn(),
      recordMerge: vi.fn(),
      recordAuditEvent: vi.fn(async () => undefined),
      recordQualityGate: vi.fn(),
      computeFeatureEval: vi.fn(async () => null),
      recordSecurityFindings: vi.fn(),
      declarePropagationTarget: vi.fn(),
      listRelatedLearnings: vi.fn(async () => []),
      listAllLearnings: vi.fn(async () => []),
      replaceSkillProposalCandidates: vi.fn(),
      listSkillProposalCandidates: vi.fn(async () => []),
      upsertSkillProposalDraft: vi.fn(),
      listSkillProposals: vi.fn(async () => []),
      recordSkillProposalDecision: vi.fn(),
      markSkillProposalPublished: vi.fn(),
    } as unknown as WorkflowStateAdapter;

    const result = await handlePickNextAutonomousPhase(adapter, createSkillAdapter(), createConfig('guarded'), {
      supervisor_name: 'ralph-loop',
      include_artifacts: true,
      include_skills: true,
      include_learnings: true,
    });
    const payload = result.structuredContent as {
      selection: { feature_id: string; phase: string; reason: string };
      skipped_summary: Array<{ feature_id: string; status: string }>;
      context: { feature: { id: string }; automation: { configured_mode: string } };
    };

    expect(result.isError).toBeUndefined();
    expect(adapter.listFeatures).toHaveBeenCalledWith({ statuses: ['IN_PROGRESS', 'BLOCKED'] });
    expect(payload.selection).toMatchObject({
      feature_id: 'FEAT-RUN',
      phase: '5',
      reason: 'ready_for_phase',
    });
    expect(payload.context.feature.id).toBe('FEAT-RUN');
    expect(payload.context.automation.configured_mode).toBe('guarded');
    expect(payload.skipped_summary).toContainEqual(
      expect.objectContaining({
        feature_id: 'FEAT-WAIT',
        status: 'waiting_on_human_merge',
      })
    );
    expect(adapter.recordAuditEvent).toHaveBeenCalledWith(
      'FEAT-RUN',
      'AUTONOMOUS_PICK_SELECTED',
      'ralph-loop',
      expect.objectContaining({ phase: '5' })
    );
  });

  it('returns no selection when every feature is waiting on a human boundary', async () => {
    const feature = createFeature({ current_phase: '9' });
    const adapter: WorkflowStateAdapter = {
      listFeatures: vi.fn(async () => [feature]),
      getFeature: vi.fn(async () => feature),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGateRecords: vi.fn(async () => []),
      listOpenFindings: vi.fn(async () => []),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => []),
      listClaimsNeedingReview: vi.fn(async () => []),
      listAgentInvocations: vi.fn(async () => []),
    } as unknown as WorkflowStateAdapter;

    const result = await handlePickNextAutonomousPhase(adapter, createSkillAdapter(), createConfig('guarded'), {
      supervisor_name: 'ralph-loop',
      include_artifacts: true,
      include_skills: true,
      include_learnings: true,
    });
    const payload = result.structuredContent as {
      selection: null;
      skipped_summary: Array<{ feature_id: string; status: string }>;
    };

    expect(payload.selection).toBeNull();
    expect(payload.skipped_summary).toContainEqual(
      expect.objectContaining({
        feature_id: 'FEAT-AUTO',
        status: 'waiting_on_human_pr',
      })
    );
  });

  it('filters picks by allowed selection reasons', async () => {
    const features = [
      createFeature({ id: 'FEAT-BUILD', current_phase: '5' }),
      createFeature({
        id: 'FEAT-RELEASE',
        current_phase: '9',
        pr_url: 'https://github.com/org/repo/pull/42',
        pr_number: 42,
        merged_at: '2026-04-01T00:00:00.000Z',
      }),
    ];
    const by_id = new Map(features.map((feature) => [feature.id, feature]));
    const adapter: WorkflowStateAdapter = {
      listFeatures: vi.fn(async () => features),
      getFeature: vi.fn(async (feature_id: string) => by_id.get(feature_id) ?? null),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGateRecords: vi.fn(async () => []),
      listOpenFindings: vi.fn(async () => []),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => []),
      listClaimsNeedingReview: vi.fn(async () => []),
      listAgentInvocations: vi.fn(async () => []),
      findOpenAgentInvocation: vi.fn(async () => null),
      startAgentInvocation: vi.fn(async (feature_id: string, phase: FeatureRecord['current_phase'], agent_name: string) => ({
        id: `inv_${feature_id}`,
        feature_id,
        phase,
        agent_name,
        operation: `Phase ${phase}`,
        skills_used: [],
        started_at: '2026-04-01T00:10:00.000Z',
        ended_at: null,
        duration_ms: null,
      })),
      listPhaseArtifacts: vi.fn(async () => []),
      listLearnings: vi.fn(async () => []),
      listRelatedLearnings: vi.fn(async () => []),
      recordAuditEvent: vi.fn(async () => undefined),
    } as unknown as WorkflowStateAdapter;

    const result = await handlePickNextAutonomousPhase(adapter, createSkillAdapter(), createConfig('guarded'), {
      supervisor_name: 'ralph-loop',
      include_artifacts: true,
      include_skills: true,
      include_learnings: true,
      allowed_phases: ['9'],
      allowed_selection_reasons: ['merged_and_ready_to_close_release'],
    });
    const payload = result.structuredContent as {
      selection: { feature_id: string; reason: string } | null;
    };

    expect(payload.selection).toMatchObject({
      feature_id: 'FEAT-RELEASE',
      reason: 'merged_and_ready_to_close_release',
    });
  });
});
