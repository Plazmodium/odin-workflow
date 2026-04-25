import { describe, expect, it, vi } from 'vitest';

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import type { FeatureRecord, PhaseExecutionAttestation, PhasePromptRealizationAttestation } from '../types.js';
import { buildPhaseContextBundleForFeature } from './prepare-phase-context.js';
import { handleRegisterPhaseRealization } from './register-phase-realization.js';

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-REAL',
    name: 'Realization Feature',
    status: 'IN_PROGRESS',
    current_phase: '5',
    complexity_level: 2,
    severity: 'ROUTINE',
    created_at: '2026-04-23T00:00:00.000Z',
    updated_at: '2026-04-23T00:00:00.000Z',
    ...overrides,
  };
}

function createExecutionAttestation(overrides: Partial<PhaseExecutionAttestation> = {}): PhaseExecutionAttestation {
  return {
    feature_id: 'FEAT-REAL',
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
    recorded_at: '2026-04-23T00:10:00.000Z',
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

function createContextAdapter(): WorkflowStateAdapter {
  return {
    listPhaseArtifacts: vi.fn(async () => []),
    listLearnings: vi.fn(async () => []),
    listRelatedLearnings: vi.fn(async () => []),
    listOpenBlockers: vi.fn(async () => []),
    listOpenGateRecords: vi.fn(async () => []),
    listOpenFindings: vi.fn(async () => []),
    listPendingClaims: vi.fn(async () => []),
    listClaimVerificationStatus: vi.fn(async () => []),
    listClaimsNeedingReview: vi.fn(async () => []),
    findOpenAgentInvocation: vi.fn(async () => null),
    startAgentInvocation: vi.fn(async () => null),
  } as unknown as WorkflowStateAdapter;
}

async function createBuilderManifest() {
  const bundle = await buildPhaseContextBundleForFeature(
    createFeature(),
    createContextAdapter(),
    createSkillAdapter(),
    createConfig(),
    {
      feature_id: 'FEAT-REAL',
      phase: '5',
      include_artifacts: true,
      include_skills: true,
      include_learnings: true,
    },
    { open_invocation: false },
  );

  return bundle.execution.phase_prompt_manifest!;
}

describe('handleRegisterPhaseRealization', () => {
  it('records a bundle-attested prompt realization', async () => {
    const builder_manifest = await createBuilderManifest();
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
      getPhaseExecutionAttestation: vi.fn(async () => createExecutionAttestation()),
      registerPhasePromptRealization: vi.fn(async (attestation: PhasePromptRealizationAttestation) => attestation),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRegisterPhaseRealization(adapter, createSkillAdapter(), createConfig(), {
      feature_id: 'FEAT-REAL',
      phase: '5',
      manifest: builder_manifest,
      actual_mode: 'subagent',
      supervisor_session_id: 'ralph-loop:run-1',
      worker_session_id: 'ralph-loop:run-1:worker',
      harness_run_id: 'run-1',
      attested_by: 'ralph-loop',
      child_prompt_hash: 'c'.repeat(64),
      proof_status: 'bundle_attested',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.registerPhasePromptRealization).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_id: 'FEAT-REAL',
        phase: '5',
        prompt_realization_policy: 'phase_bundle_preferred',
        actual_mode: 'subagent',
        proof_status: 'bundle_attested',
      })
    );
    expect((adapter.registerPhasePromptRealization as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.manifest_id).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects realization when no execution attestation exists first', async () => {
    const builder_manifest = await createBuilderManifest();
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
      registerPhasePromptRealization: vi.fn(),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRegisterPhaseRealization(adapter, createSkillAdapter(), createConfig(), {
      feature_id: 'FEAT-REAL',
      phase: '5',
      manifest: builder_manifest,
      actual_mode: 'subagent',
      supervisor_session_id: 'ralph-loop:run-1',
      worker_session_id: 'ralph-loop:run-1:worker',
      harness_run_id: 'run-1',
      attested_by: 'ralph-loop',
      child_prompt_hash: 'c'.repeat(64),
      proof_status: 'bundle_attested',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('must have an execution attestation before prompt realization');
    expect(adapter.registerPhasePromptRealization).not.toHaveBeenCalled();
  });

  it('rejects realization when manifest role does not match the canonical phase role', async () => {
    const builder_manifest = await createBuilderManifest();
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
      getPhaseExecutionAttestation: vi.fn(async () => createExecutionAttestation()),
      registerPhasePromptRealization: vi.fn(),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRegisterPhaseRealization(adapter, createSkillAdapter(), createConfig(), {
      feature_id: 'FEAT-REAL',
      phase: '5',
      manifest: {
        ...builder_manifest,
        phase_role_name: 'reviewer-agent',
      },
      actual_mode: 'subagent',
      supervisor_session_id: 'ralph-loop:run-1',
      worker_session_id: 'ralph-loop:run-1:worker',
      harness_run_id: 'run-1',
      attested_by: 'ralph-loop',
      child_prompt_hash: 'c'.repeat(64),
      proof_status: 'bundle_attested',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('does not match the canonical phase role');
    expect(adapter.registerPhasePromptRealization).not.toHaveBeenCalled();
  });

  it('rejects realization when manifest_id does not match the manifest payload', async () => {
    const builder_manifest = await createBuilderManifest();
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
      getPhaseExecutionAttestation: vi.fn(async () => createExecutionAttestation()),
      registerPhasePromptRealization: vi.fn(),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRegisterPhaseRealization(adapter, createSkillAdapter(), createConfig(), {
      feature_id: 'FEAT-REAL',
      phase: '5',
      manifest: {
        ...builder_manifest,
        manifest_id: 'wrong-manifest-id',
      },
      actual_mode: 'subagent',
      supervisor_session_id: 'ralph-loop:run-1',
      worker_session_id: 'ralph-loop:run-1:worker',
      harness_run_id: 'run-1',
      attested_by: 'ralph-loop',
      child_prompt_hash: 'c'.repeat(64),
      proof_status: 'bundle_attested',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('manifest_id does not match the submitted manifest payload');
    expect(adapter.registerPhasePromptRealization).not.toHaveBeenCalled();
  });
});
