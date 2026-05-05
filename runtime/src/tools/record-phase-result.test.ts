import { describe, expect, it, vi } from 'vitest';

import type { ArchiveAdapter } from '../adapters/archive/types.js';
import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import type {
  FeatureRecord,
  PhaseArtifact,
  PhaseExecutionAttestation,
  PhasePromptRealizationAttestation,
  PhaseResultRecord,
} from '../types.js';
import { handleRecordPhaseResult } from './record-phase-result.js';

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-RESULT',
    name: 'Result Feature',
    status: 'IN_PROGRESS',
    current_phase: '5',
    complexity_level: 2,
    severity: 'ROUTINE',
    author: 'Jane Doe',
    created_at: '2026-03-20T00:00:00.000Z',
    updated_at: '2026-03-20T00:00:00.000Z',
    ...overrides,
  };
}

function createConfig(): RuntimeConfig {
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
  };
}

function createStrictConfig(): RuntimeConfig {
  return {
    ...createConfig(),
    attestation: {
      mode: 'strict',
      require_execution_phases: ['5', '6', '7', '9'],
      require_prompt_realization_phases: ['5', '6', '7', '9'],
    },
  };
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

function createTasksArtifact(content: unknown): PhaseArtifact {
  return {
    id: 'artifact_tasks',
    feature_id: 'FEAT-RESULT',
    phase: '3',
    output_type: 'tasks',
    content,
    created_by: 'architect-agent',
    created_at: '2026-03-20T00:00:00.000Z',
  };
}

function createPromptRealizationAttestation(overrides: Partial<PhasePromptRealizationAttestation> = {}): PhasePromptRealizationAttestation {
  return {
    feature_id: 'FEAT-RESULT',
    phase: '5',
    phase_role_name: 'builder-agent',
    prompt_realization_policy: 'phase_bundle_preferred',
    manifest_id: 'manifest-1',
    manifest_version: '1',
    shared_context_hash: 'a'.repeat(64),
    phase_definition_hash: 'b'.repeat(64),
    resolved_skill_hashes: ['c'.repeat(64)],
    required_prompt_sections: ['phase', 'role_summary', 'constraints'],
    context_bundle_hash: 'd'.repeat(64),
    nonce: 'nonce-1',
    actual_mode: 'subagent',
    proof_status: 'bundle_attested',
    supervisor_session_id: 'ralph-loop:run-1',
    worker_session_id: 'ralph-loop:run-1:worker',
    harness_run_id: 'run-1',
    attested_by: 'ralph-loop',
    child_prompt_hash: 'e'.repeat(64),
    wrapper_hash: null,
    child_ack_nonce: null,
    recorded_at: '2026-03-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('handleRecordPhaseResult', () => {
  it('normalizes harness actors, completes open invocations, and auto-completes remaining Builder tasks', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      listPhaseArtifacts: vi.fn(async () => [
        createTasksArtifact([{ id: 'T1', title: 'Add tests', status: 'pending' }]),
      ]),
      listLearnings: vi.fn(async () => []),
      listRelatedLearnings: vi.fn(async () => []),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGateRecords: vi.fn(async () => []),
      listOpenFindings: vi.fn(async () => []),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => []),
      listClaimsNeedingReview: vi.fn(async () => []),
      recordPhaseArtifact: vi.fn(async (artifact: PhaseArtifact) => artifact),
      getPhaseExecutionAttestation: vi.fn(async () => ({
        feature_id: 'FEAT-RESULT',
        phase: '5',
        execution_policy: 'distinct_session_preferred',
        recommended_mode: 'subagent',
        actual_mode: 'subagent',
        proof_status: 'attested',
        supervisor_session_id: 'ralph-loop:run-1',
        worker_session_id: 'ralph-loop:run-1:worker',
        harness_run_id: 'run-1',
        attested_by: 'ralph-loop',
        attestation_source: 'harness',
        recorded_at: '2026-03-20T00:00:00.000Z',
      } satisfies PhaseExecutionAttestation)),
      getPhasePromptRealization: vi.fn(async () => createPromptRealizationAttestation()),
      findOpenAgentInvocation: vi.fn(async () => ({
        id: 'inv_open',
        feature_id: 'FEAT-RESULT',
        phase: '5',
        agent_name: 'builder-agent',
        operation: 'Phase 5: Builder',
        skills_used: ['testing/unit-tests-sdd'],
        started_at: '2026-03-20T00:00:00.000Z',
        ended_at: null,
        duration_ms: null,
      })),
      completeAgentInvocation: vi.fn(async () => ({
        id: 'inv_open',
        feature_id: 'FEAT-RESULT',
        phase: '5',
        agent_name: 'builder-agent',
        operation: 'Phase 5: Builder',
        skills_used: ['testing/unit-tests-sdd'],
        started_at: '2026-03-20T00:00:00.000Z',
        ended_at: '2026-03-20T00:05:00.000Z',
        duration_ms: 300000,
      })),
      recordPhaseResult: vi.fn(async (result: PhaseResultRecord) => createFeature({ current_phase: result.next_phase ?? '6' })),
      recordQualityGate: vi.fn(async () => 1),
      computeFeatureEval: vi.fn(async () => null),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPhaseResult(adapter, createSkillAdapter(), createConfig(), null, {
      feature_id: 'FEAT-RESULT',
      phase: '5',
      outcome: 'completed',
      summary: 'Builder finished implementation',
      created_by: 'opencode',
      blockers: [],
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordPhaseArtifact).toHaveBeenCalledTimes(1);
    expect(adapter.recordPhaseArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_id: 'FEAT-RESULT',
        phase: '3',
        created_by: 'builder-agent',
        content: [{ id: 'T1', title: 'Add tests', status: 'completed' }],
      })
    );
    expect(adapter.recordPhaseResult).toHaveBeenCalledWith(
      expect.objectContaining({
        created_by: 'builder-agent',
      })
    );
    expect(adapter.completeAgentInvocation).toHaveBeenCalledWith('inv_open');
    expect(adapter.recordQualityGate).toHaveBeenCalledWith(
      'FEAT-RESULT',
      'builder_phase_complete',
      'APPROVED',
      'builder-agent',
      'Builder finished implementation',
      '5'
    );
  });

  it('blocks Release completion until a merge is recorded', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature({ current_phase: '9' })),
      listPhaseArtifacts: vi.fn(async () => []),
      listLearnings: vi.fn(async () => []),
      listRelatedLearnings: vi.fn(async () => []),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGateRecords: vi.fn(async () => []),
      listOpenFindings: vi.fn(async () => []),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => []),
      listClaimsNeedingReview: vi.fn(async () => []),
      getPhaseExecutionAttestation: vi.fn(async () => ({
        feature_id: 'FEAT-RESULT',
        phase: '9',
        execution_policy: 'distinct_session_preferred',
        recommended_mode: 'inline',
        actual_mode: 'inline',
        proof_status: 'attested',
        supervisor_session_id: 'ralph-loop:run-9',
        worker_session_id: 'ralph-loop:run-9',
        harness_run_id: 'run-9',
        attested_by: 'ralph-loop',
        attestation_source: 'harness',
        recorded_at: '2026-03-20T00:00:00.000Z',
      } satisfies PhaseExecutionAttestation)),
      getPhasePromptRealization: vi.fn(async () => null),
      recordPhaseResult: vi.fn(),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPhaseResult(adapter, createSkillAdapter(), createConfig(), null, {
      feature_id: 'FEAT-RESULT',
      phase: '9',
      outcome: 'completed',
      next_phase: '10',
      summary: 'Release finished, ready to close',
      created_by: 'opencode',
      blockers: [],
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('cannot complete Release until a merge has been recorded');
    expect(adapter.recordPhaseResult).not.toHaveBeenCalled();
  });

  it('uses the runtime-owned completion flow when Release closes after merge', async () => {
    const archive_adapter: ArchiveAdapter = {
      uploadArchive: vi.fn(),
      recordArchive: vi.fn(),
      listArchives: vi.fn(async () => []),
    } as unknown as ArchiveAdapter;
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () =>
        createFeature({
          current_phase: '9',
          merged_at: '2026-03-20T01:00:00.000Z',
          pr_url: 'https://github.com/org/repo/pull/42',
          pr_number: 42,
        })
      ),
      listPhaseArtifacts: vi.fn(async () => []),
      listLearnings: vi.fn(async () => []),
      listRelatedLearnings: vi.fn(async () => []),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGateRecords: vi.fn(async () => []),
      listOpenFindings: vi.fn(async () => []),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => []),
      listClaimsNeedingReview: vi.fn(async () => []),
      getPhaseExecutionAttestation: vi.fn(async () => ({
        feature_id: 'FEAT-RESULT',
        phase: '9',
        execution_policy: 'distinct_session_preferred',
        recommended_mode: 'inline',
        actual_mode: 'inline',
        proof_status: 'attested',
        supervisor_session_id: 'ralph-loop:run-9',
        worker_session_id: 'ralph-loop:run-9',
        harness_run_id: 'run-9',
        attested_by: 'ralph-loop',
        attestation_source: 'harness',
        recorded_at: '2026-03-20T00:00:00.000Z',
      } satisfies PhaseExecutionAttestation)),
      getPhasePromptRealization: vi.fn(async () => null),
      findOpenAgentInvocation: vi.fn(async () => ({
        id: 'inv_release',
        feature_id: 'FEAT-RESULT',
        phase: '9',
        agent_name: 'release-agent',
        operation: 'Phase 9: Release',
        skills_used: [],
        started_at: '2026-03-20T00:00:00.000Z',
        ended_at: null,
        duration_ms: null,
      })),
      completeAgentInvocation: vi.fn(async () => ({
        id: 'inv_release',
        feature_id: 'FEAT-RESULT',
        phase: '9',
        agent_name: 'release-agent',
        operation: 'Phase 9: Release',
        skills_used: [],
        started_at: '2026-03-20T00:00:00.000Z',
        ended_at: '2026-03-20T00:05:00.000Z',
        duration_ms: 300000,
      })),
      recordPhaseResult: vi.fn(async () =>
        createFeature({
          status: 'COMPLETED',
          current_phase: '10',
          merged_at: '2026-03-20T01:00:00.000Z',
          completed_at: '2026-03-20T01:05:00.000Z',
        })
      ),
      recordQualityGate: vi.fn(async () => 1),
      getLatestFeatureEval: vi.fn(async () => ({
        id: 'eval_release',
        feature_id: 'FEAT-RESULT',
        computed_at: '2026-03-20T01:05:00.000Z',
        efficiency_score: 95,
        quality_score: 97,
        overall_score: 96,
        health_status: 'HEALTHY',
      })),
      computeFeatureEval: vi.fn(async () => null),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPhaseResult(adapter, createSkillAdapter(), createConfig(), archive_adapter, {
      feature_id: 'FEAT-RESULT',
      phase: '9',
      outcome: 'completed',
      next_phase: '10',
      summary: 'Release finished after merge',
      created_by: 'opencode',
      blockers: [],
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordPhaseResult).toHaveBeenCalledWith(
      expect.objectContaining({
        created_by: 'release-agent',
        next_phase: '10',
      })
    );
    expect(
      (adapter.completeAgentInvocation as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    ).toBeLessThan((adapter.recordPhaseResult as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]);
    expect(adapter.getLatestFeatureEval).toHaveBeenCalledWith('FEAT-RESULT');
    expect(adapter.computeFeatureEval).not.toHaveBeenCalled();
    expect(archive_adapter.uploadArchive).not.toHaveBeenCalled();
    expect(result.structuredContent?.feature_eval).toMatchObject({
      id: 'eval_release',
    });
  });

  it('returns a warning when a preferred distinct-session phase closes without an attestation', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
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
      findOpenAgentInvocation: vi.fn(async () => ({
        id: 'inv_warn',
        feature_id: 'FEAT-RESULT',
        phase: '5',
        agent_name: 'builder-agent',
        operation: 'Phase 5: Builder',
        skills_used: [],
        started_at: '2026-03-20T00:00:00.000Z',
        ended_at: null,
        duration_ms: null,
      })),
      completeAgentInvocation: vi.fn(async () => ({
        id: 'inv_warn',
        feature_id: 'FEAT-RESULT',
        phase: '5',
        agent_name: 'builder-agent',
        operation: 'Phase 5: Builder',
        skills_used: [],
        started_at: '2026-03-20T00:00:00.000Z',
        ended_at: '2026-03-20T00:05:00.000Z',
        duration_ms: 300000,
      })),
      recordPhaseResult: vi.fn(async () => createFeature({ current_phase: '6' })),
      recordQualityGate: vi.fn(async () => 1),
      computeFeatureEval: vi.fn(async () => null),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPhaseResult(adapter, createSkillAdapter(), createConfig(), null, {
      feature_id: 'FEAT-RESULT',
      phase: '5',
      outcome: 'completed',
      summary: 'Builder finished implementation',
      created_by: 'opencode',
      blockers: [],
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Warning: Phase 5 (builder-agent) prefers a distinct worker session');
    expect(result.content[0]?.text).toContain('prefers attested realization from the Odin phase bundle');
    expect(result.structuredContent?.execution).toMatchObject({
      warning: expect.stringContaining('prefers a distinct worker session'),
      error: null,
    });
    expect(result.structuredContent?.prompt_realization).toMatchObject({
      warning: expect.stringContaining('prefers attested realization from the Odin phase bundle'),
      error: null,
    });
  });

  it('blocks strict phase completion when an expected artifact path is missing', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature({ current_phase: '8' })),
      listPhaseArtifacts: vi.fn(async () => [
        {
          id: 'artifact_documentation',
          feature_id: 'FEAT-RESULT',
          phase: '8',
          output_type: 'documentation',
          content: { summary: 'Docs updated' },
          created_by: 'documenter-agent',
          created_at: '2026-03-20T00:00:00.000Z',
        },
      ]),
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
      recordPhaseResult: vi.fn(async () => createFeature({ current_phase: '9' })),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPhaseResult(adapter, createSkillAdapter(), createStrictConfig(), null, {
      feature_id: 'FEAT-RESULT',
      phase: '8',
      outcome: 'completed',
      summary: 'Documentation complete',
      created_by: 'opencode',
      blockers: [],
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('documentation-report\\.md');
    expect(result.structuredContent?.artifact_completion).toMatchObject({
      mode: 'strict',
      missing: [
        expect.objectContaining({
          output_type: 'documentation',
          artifact_path_pattern: 'documentation-report\\.md$',
        }),
      ],
    });
    expect(adapter.recordPhaseResult).not.toHaveBeenCalled();
  });

  it('blocks strict phases without execution attestation unless an override reason is supplied', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
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
      recordPhaseResult: vi.fn(async () => createFeature({ current_phase: '6' })),
      findOpenAgentInvocation: vi.fn(async () => null),
      startAgentInvocation: vi.fn(async () => ({
        id: 'inv_strict',
        feature_id: 'FEAT-RESULT',
        phase: '5',
        agent_name: 'builder-agent',
        operation: 'Phase 5: Builder (fallback)',
        skills_used: [],
        started_at: '2026-03-20T00:00:00.000Z',
        ended_at: null,
        duration_ms: null,
      })),
      completeAgentInvocation: vi.fn(async () => ({
        id: 'inv_strict',
        feature_id: 'FEAT-RESULT',
        phase: '5',
        agent_name: 'builder-agent',
        operation: 'Phase 5: Builder (fallback)',
        skills_used: [],
        started_at: '2026-03-20T00:00:00.000Z',
        ended_at: '2026-03-20T00:05:00.000Z',
        duration_ms: 300000,
      })),
      recordQualityGate: vi.fn(async () => 1),
      computeFeatureEval: vi.fn(async () => null),
    } as unknown as WorkflowStateAdapter;

    const blocked = await handleRecordPhaseResult(adapter, createSkillAdapter(), createStrictConfig(), null, {
      feature_id: 'FEAT-RESULT',
      phase: '5',
      outcome: 'completed',
      summary: 'Builder finished implementation',
      created_by: 'opencode',
      blockers: [],
    });

    expect(blocked.isError).toBe(true);
    expect(blocked.content[0]?.text).toContain('requires a distinct worker session');
    expect(adapter.recordPhaseResult).not.toHaveBeenCalled();

    const overridden = await handleRecordPhaseResult(adapter, createSkillAdapter(), createStrictConfig(), null, {
      feature_id: 'FEAT-RESULT',
      phase: '5',
      outcome: 'completed',
      summary: 'Builder finished implementation',
      created_by: 'opencode',
      blockers: [],
      attestation_override_reason: 'Manual emergency workflow; child session was unavailable.',
    });

    expect(overridden.isError).toBeUndefined();
    expect(overridden.content[0]?.text).toContain('Override accepted');
    expect(adapter.recordPhaseResult).toHaveBeenCalledTimes(1);
  });
});
