import { describe, expect, it, vi } from 'vitest';

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import type { AgentInvocationRecord, FeatureRecord, PhaseArtifact, PhaseResultRecord } from '../types.js';
import { handleCompletePhaseBundle } from './complete-phase-bundle.js';

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

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-BUNDLE',
    name: 'Bundle Feature',
    status: 'IN_PROGRESS',
    current_phase: '8',
    complexity_level: 2,
    severity: 'ROUTINE',
    created_at: '2026-03-20T00:00:00.000Z',
    updated_at: '2026-03-20T00:00:00.000Z',
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

function createInvocation(overrides: Partial<AgentInvocationRecord> = {}): AgentInvocationRecord {
  return {
    id: 'inv_bundle',
    feature_id: 'FEAT-BUNDLE',
    phase: '8',
    agent_name: 'documenter-agent',
    operation: 'Phase 8: Documenter (fallback)',
    skills_used: [],
    started_at: '2026-03-20T00:00:00.000Z',
    ended_at: null,
    duration_ms: null,
    ...overrides,
  };
}

describe('handleCompletePhaseBundle', () => {
  it('records artifacts, checks policy and watchers, then records the phase result', async () => {
    const artifacts: PhaseArtifact[] = [];
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      recordPhaseArtifact: vi.fn(async (artifact: PhaseArtifact) => {
        artifacts.push(artifact);
        return artifact;
      }),
      listPhaseArtifacts: vi.fn(async () => artifacts),
      listLearnings: vi.fn(async () => []),
      listRelatedLearnings: vi.fn(async () => []),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGateRecords: vi.fn(async () => []),
      listOpenFindings: vi.fn(async () => []),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => []),
      listClaimsNeedingReview: vi.fn(async () => []),
      runPolicyChecks: vi.fn(async () => []),
      getPhaseExecutionAttestation: vi.fn(async () => null),
      getPhasePromptRealization: vi.fn(async () => null),
      findOpenAgentInvocation: vi.fn(async () => null),
      startAgentInvocation: vi.fn(async () => createInvocation()),
      completeAgentInvocation: vi.fn(async () =>
        createInvocation({
          ended_at: '2026-03-20T00:05:00.000Z',
          duration_ms: 300000,
        }),
      ),
      recordPhaseResult: vi.fn(async (result: PhaseResultRecord) => createFeature({ current_phase: result.next_phase ?? '9' })),
      recordQualityGate: vi.fn(async () => 1),
      computeFeatureEval: vi.fn(async () => null),
    } as unknown as WorkflowStateAdapter;

    const result = await handleCompletePhaseBundle(adapter, createSkillAdapter(), createConfig(), null, {
      feature_id: 'FEAT-BUNDLE',
      phase: '8',
      created_by: 'opencode',
      summary: 'Documentation complete',
      outcome: 'completed',
      blockers: [],
      artifacts: [
        {
          output_type: 'documentation',
          content: { summary: 'Docs updated' },
          artifact_path: 'specs/FEAT-BUNDLE/documentation-report.md',
        },
      ],
      claims: [],
      run_policy_checks: true,
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordPhaseArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact_path: 'specs/FEAT-BUNDLE/documentation-report.md',
        created_by: 'documenter-agent',
      }),
    );
    expect(adapter.runPolicyChecks).toHaveBeenCalledWith('FEAT-BUNDLE');
    expect(adapter.recordPhaseResult).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: '8',
        summary: 'Documentation complete',
      }),
    );
    expect(result.structuredContent).toMatchObject({
      watcher_status: {
        claims_needing_review_count: 0,
        blocking: false,
      },
      steps: expect.arrayContaining([
        expect.objectContaining({ name: 'artifact:1:documentation', status: 'completed' }),
        expect.objectContaining({ name: 'policy_checks', status: 'completed' }),
        expect.objectContaining({ name: 'watcher_status', status: 'completed' }),
        expect.objectContaining({ name: 'phase_result', status: 'completed' }),
      ]),
    });
  });

  it('preflights strict expected artifacts before writing bundle records', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      recordPhaseArtifact: vi.fn(async (artifact: PhaseArtifact) => artifact),
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
      recordPhaseResult: vi.fn(),
    } as unknown as WorkflowStateAdapter;

    const result = await handleCompletePhaseBundle(adapter, createSkillAdapter(), createStrictConfig(), null, {
      feature_id: 'FEAT-BUNDLE',
      phase: '8',
      created_by: 'opencode',
      summary: 'Documentation complete',
      outcome: 'completed',
      blockers: [],
      artifacts: [
        {
          output_type: 'documentation',
          content: { summary: 'Docs updated' },
        },
      ],
      claims: [],
      run_policy_checks: true,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('documentation-report\\.md');
    expect(adapter.recordPhaseArtifact).not.toHaveBeenCalled();
    expect(adapter.recordPhaseResult).not.toHaveBeenCalled();
  });

  it('rejects strict attestation overrides before writing bundle records', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature({ current_phase: '5' })),
      recordPhaseArtifact: vi.fn(async (artifact: PhaseArtifact) => artifact),
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
      recordPhaseResult: vi.fn(),
      recordAuditEvent: vi.fn(async () => undefined),
    } as unknown as WorkflowStateAdapter;

    const result = await handleCompletePhaseBundle(adapter, createSkillAdapter(), createStrictConfig(), null, {
      feature_id: 'FEAT-BUNDLE',
      phase: '5',
      created_by: 'opencode',
      summary: 'Builder complete',
      outcome: 'completed',
      blockers: [],
      artifacts: [],
      claims: [],
      run_policy_checks: true,
      attestation_override_reason: 'Manual emergency workflow; child session was unavailable.',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('requires a distinct worker session');
    expect(result.structuredContent).toMatchObject({
      recovery: expect.stringContaining('dedicated break-glass process'),
    });
    expect(adapter.recordAuditEvent).toHaveBeenCalledWith(
      'FEAT-BUNDLE',
      'STRICT_ATTESTATION_OVERRIDE_REJECTED',
      'builder-agent',
      expect.objectContaining({ missing_proof: 'execution_attestation' }),
    );
    expect(adapter.recordPhaseArtifact).not.toHaveBeenCalled();
    expect(adapter.recordPhaseResult).not.toHaveBeenCalled();
  });
});
