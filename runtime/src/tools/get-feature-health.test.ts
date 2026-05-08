import { describe, expect, it, vi } from 'vitest';

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import type {
  AgentInvocationRecord,
  ClaimVerificationSummary,
  FeatureRecord,
  PhaseArtifact,
  QualityGateRecord,
  WatcherQueueClaim,
} from '../types.js';
import { handleGetFeatureHealth } from './get-feature-health.js';

function createConfig(mode: 'advisory' | 'strict' = 'advisory'): RuntimeConfig {
  return {
    runtime: { mode: 'in_memory' },
    attestation: {
      mode,
      require_execution_phases: ['5', '6', '7', '9'],
      require_prompt_realization_phases: ['5', '6', '7', '9'],
    },
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
  };
}

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-HEALTH',
    name: 'Feature Health Test',
    status: 'IN_PROGRESS',
    current_phase: '5',
    complexity_level: 2,
    severity: 'ROUTINE',
    base_branch: 'main',
    branch_name: 'gh/feature/FEAT-HEALTH',
    created_at: '2026-05-08T00:00:00.000Z',
    updated_at: '2026-05-08T00:00:00.000Z',
    ...overrides,
  };
}

interface AdapterOverrides {
  artifacts?: PhaseArtifact[];
  open_blockers?: string[];
  open_gate_records?: QualityGateRecord[];
  open_findings?: string[];
  pending_claims?: string[];
  claim_verification?: ClaimVerificationSummary[];
  claims_needing_review?: WatcherQueueClaim[];
  invocations?: AgentInvocationRecord[];
}

function createWorkflowAdapter(feature: FeatureRecord | null, overrides: AdapterOverrides = {}): WorkflowStateAdapter {
  return {
    startFeature: vi.fn(),
    getFeature: vi.fn(async () => feature),
    listFeatures: vi.fn(async () => []),
    recordPhaseArtifact: vi.fn(),
    listPhaseArtifacts: vi.fn(async () => overrides.artifacts ?? []),
    recordPhaseResult: vi.fn(),
    completeFeature: vi.fn(),
    listOpenBlockers: vi.fn(async () => overrides.open_blockers ?? []),
    listOpenGates: vi.fn(async () => []),
    listOpenGateRecords: vi.fn(async () => overrides.open_gate_records ?? []),
    listOpenFindings: vi.fn(async () => overrides.open_findings ?? []),
    listPendingClaims: vi.fn(async () => overrides.pending_claims ?? []),
    listClaimVerificationStatus: vi.fn(async () => overrides.claim_verification ?? []),
    getClaim: vi.fn(),
    submitClaim: vi.fn(),
    runPolicyChecks: vi.fn(),
    listClaimsNeedingReview: vi.fn(async () => overrides.claims_needing_review ?? []),
    recordWatcherReview: vi.fn(),
    getLatestFeatureEval: vi.fn(async () => null),
    recordReviewCheck: vi.fn(),
    listReviewChecks: vi.fn(async () => []),
    captureLearning: vi.fn(),
    listLearnings: vi.fn(async () => []),
    listRelatedLearnings: vi.fn(async () => []),
    listAgentInvocations: vi.fn(async () => overrides.invocations ?? []),
    findOpenAgentInvocation: vi.fn(async () => null),
    startAgentInvocation: vi.fn(),
    completeAgentInvocation: vi.fn(),
    registerPhaseExecution: vi.fn(),
    clearPhaseExecutionAttestation: vi.fn(),
    getPhaseExecutionAttestation: vi.fn(async () => null),
    listPhaseExecutionAttestations: vi.fn(async () => []),
    registerPhasePromptRealization: vi.fn(),
    getPhasePromptRealization: vi.fn(async () => null),
    listPhasePromptRealizations: vi.fn(async () => []),
    recordCommit: vi.fn(),
    recordPullRequest: vi.fn(),
    recordMerge: vi.fn(),
    recordReleaseHandoff: vi.fn(),
    recordReleaseCloseout: vi.fn(),
    recordAuditEvent: vi.fn(),
    recordQualityGate: vi.fn(),
    computeFeatureEval: vi.fn(),
    recordSecurityFindings: vi.fn(),
    declarePropagationTarget: vi.fn(),
    listAllLearnings: vi.fn(),
    replaceSkillProposalCandidates: vi.fn(),
    listSkillProposalCandidates: vi.fn(),
    upsertSkillProposalDraft: vi.fn(),
    listSkillProposals: vi.fn(),
    recordSkillProposalDecision: vi.fn(),
    markSkillProposalPublished: vi.fn(),
  } as unknown as WorkflowStateAdapter;
}

function createSkillAdapter(): SkillAdapter {
  return {
    resolveSkills: vi.fn(async () => ({ resolved: [], fallback_used: false })),
    listKnowledgeDomains: vi.fn(async () => []),
    invalidateCaches: vi.fn(),
  };
}

function workflowHealth(result: Awaited<ReturnType<typeof handleGetFeatureHealth>>) {
  return result.structuredContent as {
    feature_id: string;
    feature_name: string;
    status: string;
    summary: string;
    current_focus: { phase: string; phase_name: string };
    blockers: Array<{ kind: string; message: string; recovery: string | null }>;
    warnings: Array<{ kind: string; message: string }>;
    next_actions: string[];
  };
}

describe('handleGetFeatureHealth', () => {
  it('returns an error when the feature is missing', async () => {
    const result = await handleGetFeatureHealth(createWorkflowAdapter(null), createSkillAdapter(), createConfig(), {
      feature_id: 'MISSING',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('was not found');
  });

  it('reports a ready current phase', async () => {
    const result = await handleGetFeatureHealth(createWorkflowAdapter(createFeature()), createSkillAdapter(), createConfig(), {
      feature_id: 'FEAT-HEALTH',
    });

    const health = workflowHealth(result);
    expect(health.feature_id).toBe('FEAT-HEALTH');
    expect(health.feature_name).toBe('Feature Health Test');
    expect(health.status).toBe('ready');
    expect(health.summary).toBe('Feature FEAT-HEALTH is ready in Builder.');
    expect(health.current_focus).toEqual({ phase: '5', phase_name: 'Builder' });
    expect(health.next_actions[0]).toContain('Continue Builder');
    expect(health).not.toHaveProperty('workflow_health');
  });

  it('reports an open blocker', async () => {
    const result = await handleGetFeatureHealth(
      createWorkflowAdapter(createFeature(), { open_blockers: ['Needs product decision'] }),
      createSkillAdapter(),
      createConfig(),
      { feature_id: 'FEAT-HEALTH' },
    );

    const health = workflowHealth(result);
    expect(health.status).toBe('blocked');
    expect(health.blockers).toContainEqual(expect.objectContaining({
      kind: 'blocker',
      message: 'Needs product decision',
    }));
  });

  it('reports watcher review pending', async () => {
    const claim: WatcherQueueClaim = {
      claim_id: 'claim_1',
      feature_id: 'FEAT-HEALTH',
      phase: '5',
      agent_name: 'builder-agent',
      claim_type: 'CODE_MODIFIED',
      claim_description: 'Changed handlers',
      evidence_refs: {},
      risk_level: 'HIGH',
      policy_verdict: 'NEEDS_REVIEW',
      policy_reason: 'High-risk code change',
      created_at: '2026-05-08T00:00:00.000Z',
    };
    const result = await handleGetFeatureHealth(
      createWorkflowAdapter(createFeature(), { claims_needing_review: [claim] }),
      createSkillAdapter(),
      createConfig(),
      { feature_id: 'FEAT-HEALTH' },
    );

    const health = workflowHealth(result);
    expect(health.status).toBe('waiting_on_watchers');
    expect(health.summary).toContain('waiting on 1 claim');
    expect(health.next_actions).toContain('Have watcher-agent review each claim_id listed above.');
  });

  it('reports missing strict attestation', async () => {
    const result = await handleGetFeatureHealth(createWorkflowAdapter(createFeature()), createSkillAdapter(), createConfig('strict'), {
      feature_id: 'FEAT-HEALTH',
    });

    const health = workflowHealth(result);
    expect(health.status).toBe('needs_attention');
    expect(health.blockers[0]).toMatchObject({ kind: 'attestation' });
    expect(health.next_actions.join('\n')).toContain('odin.register_phase_execution');
  });

  it('reports missing required artifact in strict mode', async () => {
    const result = await handleGetFeatureHealth(
      createWorkflowAdapter(createFeature({ current_phase: '1' })),
      createSkillAdapter(),
      createConfig('strict'),
      { feature_id: 'FEAT-HEALTH' },
    );

    const health = workflowHealth(result);
    expect(health.status).toBe('needs_attention');
    expect(health.blockers[0]).toMatchObject({ kind: 'artifact' });
    expect(health.next_actions.join('\n')).toContain('odin.record_phase_artifact');
  });

  it('reports release waiting for human merge', async () => {
    const result = await handleGetFeatureHealth(
      createWorkflowAdapter(createFeature({ current_phase: '9', pr_url: 'https://github.com/org/repo/pull/1', pr_number: 1 })),
      createSkillAdapter(),
      createConfig(),
      { feature_id: 'FEAT-HEALTH' },
    );

    const health = workflowHealth(result);
    expect(health.status).toBe('waiting_on_human');
    expect(health.blockers[0]).toMatchObject({ kind: 'release' });
    expect(health.next_actions.join('\n')).toContain('human merge');
  });
});
