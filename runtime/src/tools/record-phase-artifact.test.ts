import { describe, expect, it, vi } from 'vitest';

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import type { FeatureRecord, PhaseArtifact } from '../types.js';
import { handleRecordPhaseArtifact } from './record-phase-artifact.js';

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-ARTIFACT',
    name: 'Artifact Feature',
    status: 'IN_PROGRESS',
    current_phase: '8',
    complexity_level: 2,
    severity: 'ROUTINE',
    created_at: '2026-03-20T00:00:00.000Z',
    updated_at: '2026-03-20T00:00:00.000Z',
    ...overrides,
  };
}

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

describe('handleRecordPhaseArtifact', () => {
  it('records optional artifact path metadata', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      recordPhaseArtifact: vi.fn(async (artifact: PhaseArtifact) => artifact),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPhaseArtifact(adapter, {
      feature_id: 'FEAT-ARTIFACT',
      phase: '8',
      output_type: 'documentation',
      content: { summary: 'Docs updated' },
      artifact_path: 'specs/FEAT-ARTIFACT/documentation-report.md',
      created_by: 'opencode',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordPhaseArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact_path: 'specs/FEAT-ARTIFACT/documentation-report.md',
        created_by: 'documenter-agent',
      }),
    );
    expect(result.structuredContent?.artifact).toMatchObject({
      artifact_path: 'specs/FEAT-ARTIFACT/documentation-report.md',
    });
  });

  it('blocks strict phase artifact writes before phase-agent prework is proven', async () => {
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
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPhaseArtifact(adapter, {
      feature_id: 'FEAT-ARTIFACT',
      phase: '5',
      output_type: 'implementation_notes',
      content: { summary: 'Implementation updated' },
      created_by: 'opencode',
    }, createSkillAdapter(), createStrictConfig());

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('before canonical phase-agent execution is proven');
    expect(result.structuredContent).toMatchObject({
      operation: 'record phase artifact',
      recovery: expect.stringContaining('register_phase_execution'),
    });
    expect(adapter.recordPhaseArtifact).not.toHaveBeenCalled();
  });
});
