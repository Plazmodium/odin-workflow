import { describe, expect, it, vi } from 'vitest';

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import { buildPhaseContextBundleForFeature } from './prepare-phase-context.js';
import type {
  ClaimVerificationSummary,
  FeatureEvalSummary,
  FeatureRecord,
  LearningRecord,
  PhaseExecutionAttestation,
  PhasePromptRealizationAttestation,
  PhaseArtifact,
  PhaseResultRecord,
  ReviewCheckRecord,
} from '../types.js';
import { handleGetFeatureStatus } from './get-feature-status.js';

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
    id: 'FEAT-002',
    name: 'Feature Status Test',
    status: 'IN_PROGRESS',
    current_phase: '5',
    complexity_level: 2,
    severity: 'ROUTINE',
    branch_name: 'gr/feature/FEAT-002',
    created_at: '2026-03-13T00:00:00.000Z',
    updated_at: '2026-03-13T00:00:00.000Z',
    ...overrides,
  };
}

function createWorkflowAdapter(feature: FeatureRecord | null): WorkflowStateAdapter {
  return {
    startFeature: vi.fn(),
    getFeature: vi.fn(async () => feature),
    recordPhaseArtifact: vi.fn(),
    listPhaseArtifacts: vi.fn(async () => [
      {
        id: 'artifact_1',
        feature_id: 'FEAT-002',
        phase: '3',
        output_type: 'spec',
        content: { approach: ['test'] },
        created_by: 'architect-agent',
        created_at: '2026-03-13T00:00:00.000Z',
      },
      {
        id: 'artifact_2',
        feature_id: 'FEAT-002',
        phase: '3',
        output_type: 'eval_plan',
        content: { cases: ['cap-1'] },
        created_by: 'architect-agent',
        created_at: '2026-03-13T00:30:00.000Z',
      },
      {
        id: 'artifact_3',
        feature_id: 'FEAT-002',
        phase: '6',
        output_type: 'eval_run',
        content: { status: 'passed' },
        created_by: 'reviewer-agent',
        created_at: '2026-03-13T02:30:00.000Z',
      },
    ] as PhaseArtifact[]),
    recordPhaseResult: vi.fn(async () => feature),
    listOpenBlockers: vi.fn(async () => ['Needs approval']),
    listOpenGateRecords: vi.fn(async () => [
      {
        id: 1,
        feature_id: 'FEAT-002',
        gate_name: 'guardian_approval',
        phase: '4',
        status: 'PENDING',
        approver: 'guardian-agent',
        approved_at: '2026-03-13T01:00:00.000Z',
        approval_notes: null,
      },
      {
        id: 2,
        feature_id: 'FEAT-002',
        gate_name: 'eval_readiness',
        phase: '4',
        status: 'REJECTED',
        approver: 'guardian-agent',
        approved_at: '2026-03-13T01:10:00.000Z',
        approval_notes: 'Regression case is still missing.',
      },
    ]),
    listOpenFindings: vi.fn(async () => ['HIGH: Finding (file.ts)']),
    listPendingClaims: vi.fn(async () => ['CODE_MODIFIED by builder-agent (NEEDS_REVIEW)']),
    listClaimsNeedingReview: vi.fn(async () => [
      {
        claim_id: 'claim_1',
        feature_id: 'FEAT-002',
        phase: '5',
        agent_name: 'builder-agent',
        claim_type: 'CODE_MODIFIED',
        claim_description: 'Changed endpoint handlers',
        evidence_refs: {},
        risk_level: 'HIGH',
        policy_verdict: 'NEEDS_REVIEW',
        policy_reason: 'Missing evidence references',
        created_at: '2026-03-13T01:00:00.000Z',
      },
    ]),
    listClaimVerificationStatus: vi.fn(async () => [
      {
        claim_id: 'claim_1',
        claim_type: 'CODE_MODIFIED',
        agent_name: 'builder-agent',
        risk_level: 'HIGH',
        policy_verdict: 'NEEDS_REVIEW',
        watcher_verdict: null,
        final_status: 'NEEDS_REVIEW',
      },
      {
        claim_id: 'claim_2',
        claim_type: 'TEST_PASSED',
        agent_name: 'builder-agent',
        risk_level: 'LOW',
        policy_verdict: 'PASS',
        watcher_verdict: null,
        final_status: 'PASS',
      },
    ] as ClaimVerificationSummary[]),
    getLatestFeatureEval: vi.fn(async () => ({
      id: 'eval_1',
      feature_id: 'FEAT-002',
      computed_at: '2026-03-13T01:00:00.000Z',
      efficiency_score: 95,
      quality_score: 100,
      overall_score: 98,
      health_status: 'HEALTHY',
    } as FeatureEvalSummary)),
    recordReviewCheck: vi.fn(),
    listReviewChecks: vi.fn(async () => [
      {
        id: 'review_1',
        feature_id: 'FEAT-002',
        phase: '6',
        tool: 'semgrep',
        status: 'passed',
        summary: '0 findings',
        changed_files: ['src/server.ts'],
        initiated_by: 'reviewer-agent',
        created_at: '2026-03-13T02:00:00.000Z',
      },
    ] as ReviewCheckRecord[]),
    captureLearning: vi.fn(),
    listLearnings: vi.fn(async () => [
      {
        id: 'learning_1',
        feature_id: 'FEAT-002',
        phase: '2',
        title: 'Learned something',
        content: 'Summary text',
        category: 'PATTERN',
        created_by: 'tester',
        created_at: '2026-03-13T03:00:00.000Z',
      },
    ] as LearningRecord[]),
    listRelatedLearnings: vi.fn(async () => []),
    listAgentInvocations: vi.fn(async () => [
      {
        id: 'inv_1',
        feature_id: 'FEAT-002',
        phase: '1',
        agent_name: 'product-agent',
        operation: 'Phase 1: Product',
        skills_used: [],
        started_at: '2026-03-13T00:00:00.000Z',
        ended_at: '2026-03-13T00:05:00.000Z',
        duration_ms: 300000,
      },
      {
        id: 'inv_2',
        feature_id: 'FEAT-002',
        phase: '2',
        agent_name: 'discovery-agent',
        operation: 'Phase 2: Discovery',
        skills_used: [],
        started_at: '2026-03-13T00:06:00.000Z',
        ended_at: '2026-03-13T00:10:00.000Z',
        duration_ms: 240000,
      },
    ]),
    listPhaseExecutionAttestations: vi.fn(async () => [
      {
        feature_id: 'FEAT-002',
        phase: '5',
        execution_policy: 'distinct_session_preferred',
        recommended_mode: 'subagent',
        actual_mode: 'subagent',
        proof_status: 'attested',
        supervisor_session_id: 'ralph-loop:run-1',
        worker_session_id: 'builder-worker-1',
        harness_run_id: 'run-1',
        attested_by: 'ralph-loop',
        attestation_source: 'harness',
        recorded_at: '2026-03-13T01:00:00.000Z',
      } satisfies PhaseExecutionAttestation,
    ]),
    listPhasePromptRealizations: vi.fn(async () => []),
    } as unknown as WorkflowStateAdapter;
}

function createSkillAdapter(): SkillAdapter {
  return {
    resolveSkills: vi.fn(async () => ({
      resolved: [],
      fallback_used: false,
    })),
    listKnowledgeDomains: vi.fn(async () => []),
    invalidateCaches: vi.fn(),
  };
}

describe('handleGetFeatureStatus', () => {
  it('returns an error when the feature is missing', async () => {
    const result = await handleGetFeatureStatus(createWorkflowAdapter(null), createSkillAdapter(), {
      runtime: { mode: 'in_memory' },
    } as RuntimeConfig, {
      feature_id: 'MISSING',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('was not found');
  });

  it('returns counts, next phase, latest review check, and latest eval summary', async () => {
    const feature = createFeature({ base_branch: 'main' });
    const adapter = createWorkflowAdapter(feature);
    const skillAdapter = createSkillAdapter();
    const bundle = await buildPhaseContextBundleForFeature(
      feature,
      adapter,
      skillAdapter,
      createConfig('auto_pr'),
      {
        feature_id: 'FEAT-002',
        phase: '5',
        include_artifacts: true,
        include_skills: true,
        include_learnings: true,
      },
      { open_invocation: false },
    );
    (adapter.listPhasePromptRealizations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        feature_id: 'FEAT-002',
        phase: '5',
        phase_role_name: 'builder-agent',
        prompt_realization_policy: 'phase_bundle_preferred',
        manifest_id: bundle.execution.phase_prompt_manifest!.manifest_id,
        manifest_version: bundle.execution.phase_prompt_manifest!.manifest_version,
        shared_context_hash: bundle.execution.phase_prompt_manifest!.shared_context_hash,
        phase_definition_hash: bundle.execution.phase_prompt_manifest!.phase_definition_hash,
        resolved_skill_hashes: bundle.execution.phase_prompt_manifest!.resolved_skill_hashes,
        required_prompt_sections: bundle.execution.phase_prompt_manifest!.required_prompt_sections,
        context_bundle_hash: bundle.execution.phase_prompt_manifest!.context_bundle_hash,
        nonce: bundle.execution.phase_prompt_manifest!.nonce,
        actual_mode: 'subagent',
        proof_status: 'bundle_attested',
        supervisor_session_id: 'ralph-loop:run-1',
        worker_session_id: 'builder-worker-1',
        harness_run_id: 'run-1',
        attested_by: 'ralph-loop',
        child_prompt_hash: 'e'.repeat(64),
        wrapper_hash: null,
        child_ack_nonce: null,
        recorded_at: '2026-03-13T01:00:00.000Z',
      } satisfies PhasePromptRealizationAttestation,
    ]);

    const result = await handleGetFeatureStatus(adapter, skillAdapter, createConfig('auto_pr'), {
      feature_id: 'FEAT-002',
    });
    const status = result.structuredContent as {
      automation: {
        configured_mode: string;
        capabilities: { can_open_pr: boolean };
        blocking_reasons: string[];
      };
      autonomy: {
        status: string;
        detail: string;
      };
      release: {
        pr_url: string | null;
        pr_number: number | null;
        merged_at: string | null;
        completed_at: string | null;
      };
      counts: Record<string, number>;
      current_phase: { name: string };
      next_phase: { name: string };
      latest_review_check: { summary: string };
      latest_feature_eval: { overall_score: number };
      workflow: {
        claim_verification_summary: Record<string, number>;
        invocation_coverage: {
          pre_release_complete: boolean;
          pre_release_missing: Array<{ phase: string; agent_name: string }>;
        };
      };
      phase_execution: {
        current_phase: {
          row: {
            actual_mode: string | null;
            execution_policy: string;
            proof_status: string;
          };
          warning: string | null;
          error: string | null;
        };
        summary: {
          counts: { attested: number; subagent_attested: number };
          preferred_without_distinct_session: Array<{ phase: string }>;
        };
      };
      prompt_realization: {
        current_phase: {
          row: {
            attested_manifest_id: string | null;
            prompt_realization_policy: string;
            proof_status: string;
          };
          warning: string | null;
          error: string | null;
        };
        summary: {
          counts: { bundle_attested: number; matching_manifest: number };
          preferred_without_bundle_realization: Array<{ phase: string }>;
        };
      };
      development_evals: unknown;
      claim_verification: unknown[];
      recent_artifacts: unknown[];
      recent_learnings: unknown[];
    };

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Feature FEAT-002 is IN_PROGRESS in Builder.');
    expect(status.counts).toEqual({
      artifacts: 3,
      review_checks: 1,
      learnings: 1,
      open_blockers: 1,
      open_gates: 2,
      open_findings: 1,
      pending_claims: 1,
    });
    expect(status.current_phase.name).toBe('Builder');
    expect(status.next_phase.name).toBe('Reviewer');
    expect(status.automation).toMatchObject({
      configured_mode: 'auto_pr',
      capabilities: {
        can_open_pr: false,
      },
    });
    expect(status.automation.blocking_reasons).toContain('1 open blocker(s) still need resolution');
    expect(status.autonomy).toMatchObject({
      status: 'blocked',
      detail: 'Needs approval',
    });
    expect(status.release).toEqual({
      pr_url: null,
      pr_number: null,
      merged_at: null,
      completed_at: null,
    });
    expect(status.latest_review_check.summary).toBe('0 findings');
    expect(status.latest_feature_eval.overall_score).toBe(98);
    expect(status.workflow.claim_verification_summary).toEqual({
      total: 2,
      passed: 1,
      failed: 0,
      needs_review: 1,
      pending: 0,
    });
    expect(status.workflow.invocation_coverage.pre_release_complete).toBe(false);
    expect(status.workflow.invocation_coverage.pre_release_missing).toContainEqual({
      phase: '3',
      agent_name: 'architect-agent',
    });
    expect(status.phase_execution.current_phase.row).toMatchObject({
      actual_mode: 'subagent',
      execution_policy: 'distinct_session_preferred',
      proof_status: 'attested',
    });
    expect(status.phase_execution.current_phase.warning).toBeNull();
    expect(status.phase_execution.summary.counts).toMatchObject({
      attested: 1,
      subagent_attested: 1,
    });
    expect(status.phase_execution.summary.preferred_without_distinct_session).toContainEqual({
      phase: '6',
      phase_role_name: 'reviewer-agent',
    });
    expect(status.prompt_realization.current_phase.row).toMatchObject({
      prompt_realization_policy: 'phase_bundle_preferred',
      proof_status: 'bundle_attested',
    });
    expect(status.prompt_realization.current_phase.row.attested_manifest_id).toMatch(/^[a-f0-9]{64}$/);
    expect(status.prompt_realization.current_phase.warning).toBeNull();
    expect(status.prompt_realization.summary.counts).toMatchObject({
      bundle_attested: 1,
      matching_manifest: 1,
    });
    expect(status.prompt_realization.summary.preferred_without_bundle_realization).toContainEqual({
      phase: '6',
      phase_role_name: 'reviewer-agent',
    });
    expect(status.development_evals).toMatchObject({
      mode: 'plan_required',
      latest_plan: {
        output_type: 'eval_plan',
      },
      latest_run: {
        output_type: 'eval_run',
      },
      open_readiness_gate: {
        status: 'REJECTED',
      },
    });
    expect(status.claim_verification).toHaveLength(2);
    expect(status.recent_artifacts).toHaveLength(3);
    expect(status.recent_learnings).toHaveLength(1);
  });

  it('keeps automation decisions aligned with watcher queue semantics', async () => {
    const feature = createFeature({ base_branch: 'main' });
    const adapter: WorkflowStateAdapter = {
      ...createWorkflowAdapter(feature),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => [
        {
          claim_id: 'claim_1',
          claim_type: 'CODE_MODIFIED',
          agent_name: 'builder-agent',
          risk_level: 'LOW',
          policy_verdict: 'PASS',
          watcher_verdict: null,
          final_status: 'PASS',
        },
      ]),
      listClaimsNeedingReview: vi.fn(async () => [
        {
          claim_id: 'claim_1',
          feature_id: 'FEAT-002',
          phase: '5',
          agent_name: 'builder-agent',
          claim_type: 'CODE_MODIFIED',
          claim_description: 'Changed endpoint handlers',
          evidence_refs: {},
          risk_level: 'LOW',
          policy_verdict: 'PASS',
          policy_reason: 'Watcher review still required',
          created_at: '2026-03-13T01:00:00.000Z',
        },
      ]),
      listAgentInvocations: vi.fn(async () => []),
      listPhaseExecutionAttestations: vi.fn(async () => []),
      listPhasePromptRealizations: vi.fn(async () => []),
    } as WorkflowStateAdapter;

    const result = await handleGetFeatureStatus(adapter, createSkillAdapter(), createConfig('auto_pr'), {
      feature_id: 'FEAT-002',
    });
    const status = result.structuredContent as {
      automation: {
        capabilities: { can_open_pr: boolean };
        blocking_reasons: string[];
      };
    };

    expect(status.automation.capabilities.can_open_pr).toBe(false);
    expect(status.automation.blocking_reasons).toContain('1 claim(s) still need watcher review');
  });

  it('treats a completed phase as covered even when the invocation used a custom actor name', async () => {
    const feature = createFeature({ base_branch: 'main' });
    const adapter: WorkflowStateAdapter = {
      ...createWorkflowAdapter(feature),
      listAgentInvocations: vi.fn(async () => [
        {
          id: 'inv_custom_release',
          feature_id: 'FEAT-002',
          phase: '1',
          agent_name: 'release-captain',
          operation: 'Phase 1: Product',
          skills_used: [],
          started_at: '2026-03-13T00:00:00.000Z',
          ended_at: '2026-03-13T00:05:00.000Z',
          duration_ms: 300000,
        },
      ]),
      listPhaseExecutionAttestations: vi.fn(async () => []),
      listPhasePromptRealizations: vi.fn(async () => []),
    } as WorkflowStateAdapter;

    const result = await handleGetFeatureStatus(adapter, createSkillAdapter(), createConfig('auto_pr'), {
      feature_id: 'FEAT-002',
    });
    const status = result.structuredContent as {
      workflow: {
        invocation_coverage: {
          pre_release_missing: Array<{ phase: string; agent_name: string }>;
        };
      };
    };

    expect(status.workflow.invocation_coverage.pre_release_missing).not.toContainEqual({
      phase: '1',
      agent_name: 'product-agent',
    });
  });
});
