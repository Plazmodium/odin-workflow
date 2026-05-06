import { describe, expect, it, vi } from 'vitest';

import type { ArchiveAdapter } from '../adapters/archive/types.js';
import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import type { FeatureRecord, PhaseExecutionAttestation } from '../types.js';
import { handleRecordReleaseCloseout } from './record-release-closeout.js';

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-RELEASE',
    name: 'Release Feature',
    status: 'IN_PROGRESS',
    current_phase: '9',
    complexity_level: 2,
    severity: 'ROUTINE',
    pr_url: 'https://github.com/org/repo/pull/42',
    pr_number: 42,
    merged_at: '2026-04-02T01:00:00.000Z',
    created_at: '2026-04-02T00:00:00.000Z',
    updated_at: '2026-04-02T00:00:00.000Z',
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
    resolveSkills: vi.fn(async () => ({ resolved: [], fallback_used: false })),
    listKnowledgeDomains: vi.fn(async () => []),
    invalidateCaches: vi.fn(),
  };
}

describe('handleRecordReleaseCloseout', () => {
  it('completes Release and records closeout lifecycle metadata', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi
        .fn()
        .mockResolvedValueOnce(createFeature())
        .mockResolvedValueOnce(createFeature())
        .mockResolvedValueOnce(createFeature({
          status: 'COMPLETED',
          current_phase: '10',
          completed_at: '2026-04-02T01:05:00.000Z',
          release_closeout_at: '2026-04-02T01:05:00.000Z',
        })),
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
        feature_id: 'FEAT-RELEASE',
        phase: '9',
        execution_policy: 'inline_allowed',
        recommended_mode: 'inline',
        actual_mode: 'inline',
        proof_status: 'attested',
        supervisor_session_id: 'ralph-loop:run-9',
        worker_session_id: 'ralph-loop:run-9',
        harness_run_id: 'run-9',
        attested_by: 'ralph-loop',
        attestation_source: 'harness',
        recorded_at: '2026-04-02T01:00:00.000Z',
      } satisfies PhaseExecutionAttestation)),
      getPhasePromptRealization: vi.fn(async () => null),
      findOpenAgentInvocation: vi.fn(async () => ({
        id: 'inv_release',
        feature_id: 'FEAT-RELEASE',
        phase: '9',
        agent_name: 'release-agent',
        operation: 'Phase 9: Release',
        skills_used: [],
        started_at: '2026-04-02T00:00:00.000Z',
        ended_at: null,
        duration_ms: null,
      })),
      completeAgentInvocation: vi.fn(async () => ({
        id: 'inv_release',
        feature_id: 'FEAT-RELEASE',
        phase: '9',
        agent_name: 'release-agent',
        operation: 'Phase 9: Release',
        skills_used: [],
        started_at: '2026-04-02T00:00:00.000Z',
        ended_at: '2026-04-02T01:05:00.000Z',
        duration_ms: 3900000,
      })),
      recordPhaseResult: vi.fn(async () => createFeature({
        status: 'COMPLETED',
        current_phase: '10',
        completed_at: '2026-04-02T01:05:00.000Z',
      })),
      recordQualityGate: vi.fn(async () => 1),
      getLatestFeatureEval: vi.fn(async () => null),
      computeFeatureEval: vi.fn(async () => null),
      recordReleaseCloseout: vi.fn(async () => ({
        feature_id: 'FEAT-RELEASE',
        closeout_created_at: '2026-04-02T01:05:00.000Z',
        closeout_created_by: 'ralph-loop',
        closeout_summary: 'Release closed after merge.',
      })),
      recordAuditEvent: vi.fn(async () => undefined),
    } as unknown as WorkflowStateAdapter;
    const archiveAdapter = null as ArchiveAdapter | null;

    const result = await handleRecordReleaseCloseout(adapter, createSkillAdapter(), createConfig(), archiveAdapter, {
      feature_id: 'FEAT-RELEASE',
      summary: 'Release closed after merge.',
      created_by: 'ralph-loop',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordPhaseResult).toHaveBeenCalledWith(
      expect.objectContaining({ phase: '9', next_phase: '10' })
    );
    expect(adapter.recordReleaseCloseout).toHaveBeenCalledWith(
      'FEAT-RELEASE',
      'Release closed after merge.',
      'ralph-loop'
    );
    expect(adapter.recordAuditEvent).toHaveBeenCalledWith(
      'FEAT-RELEASE',
      'RELEASE_CLOSEOUT_RECORDED',
      'ralph-loop',
      expect.objectContaining({ pr_number: 42 })
    );
  });

  it('allows closeout retry when phase completion succeeded but lifecycle metadata is missing', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi
        .fn()
        .mockResolvedValueOnce(createFeature({
          status: 'COMPLETED',
          current_phase: '10',
          completed_at: '2026-04-02T01:05:00.000Z',
        }))
        .mockResolvedValueOnce(createFeature({
          status: 'COMPLETED',
          current_phase: '10',
          completed_at: '2026-04-02T01:05:00.000Z',
          release_closeout_at: '2026-04-02T01:06:00.000Z',
        })),
      recordPhaseResult: vi.fn(),
      recordReleaseCloseout: vi.fn(async () => ({
        feature_id: 'FEAT-RELEASE',
        closeout_created_at: '2026-04-02T01:06:00.000Z',
        closeout_created_by: 'ralph-loop',
        closeout_summary: 'Retry closeout metadata.',
      })),
      recordAuditEvent: vi.fn(async () => undefined),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordReleaseCloseout(adapter, createSkillAdapter(), createConfig(), null, {
      feature_id: 'FEAT-RELEASE',
      summary: 'Retry closeout metadata.',
      created_by: 'ralph-loop',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordPhaseResult).not.toHaveBeenCalled();
    expect(adapter.recordReleaseCloseout).toHaveBeenCalledWith(
      'FEAT-RELEASE',
      'Retry closeout metadata.',
      'ralph-loop'
    );
    expect(result.structuredContent?.phase_result).toBeNull();
  });
});
