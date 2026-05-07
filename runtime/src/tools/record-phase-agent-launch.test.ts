import { describe, expect, it, vi } from 'vitest';

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import type { FeatureRecord } from '../types.js';
import { buildPhaseContextBundleForFeature } from './prepare-phase-context.js';
import { handleRecordPhaseAgentLaunch } from './record-phase-agent-launch.js';

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

function createFeature(): FeatureRecord {
  return {
    id: 'FEAT-LAUNCH',
    name: 'Launch Feature',
    status: 'IN_PROGRESS',
    current_phase: '5',
    complexity_level: 2,
    severity: 'ROUTINE',
    created_at: '2026-03-20T00:00:00.000Z',
    updated_at: '2026-03-20T00:00:00.000Z',
  };
}

function createSkillAdapter(): SkillAdapter {
  return {
    resolveSkills: vi.fn(async () => ({ resolved: [], fallback_used: false })),
    listKnowledgeDomains: vi.fn(async () => []),
    invalidateCaches: vi.fn(),
  };
}

function createAdapter(feature: FeatureRecord): WorkflowStateAdapter {
  return {
    getFeature: vi.fn(async () => feature),
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
    getPhaseExecutionAttestation: vi.fn(async () => null),
    getPhasePromptRealization: vi.fn(async () => null),
    recordAuditEvent: vi.fn(async () => undefined),
  } as unknown as WorkflowStateAdapter;
}

describe('handleRecordPhaseAgentLaunch', () => {
  it('records canonical subagent launch evidence', async () => {
    const feature = createFeature();
    const adapter = createAdapter(feature);
    const skillAdapter = createSkillAdapter();
    const config = createConfig();
    const context = await buildPhaseContextBundleForFeature(feature, adapter, skillAdapter, config, {
      feature_id: 'FEAT-LAUNCH',
      phase: '5',
      include_artifacts: true,
      include_skills: true,
      include_learnings: true,
    }, { open_invocation: false });

    const result = await handleRecordPhaseAgentLaunch(adapter, skillAdapter, config, {
      feature_id: 'FEAT-LAUNCH',
      phase: '5',
      launch_mode: 'subagent',
      launched_by: 'opencode',
      manifest: context.execution.phase_prompt_manifest!,
      supervisor_session_id: 'supervisor-1',
      worker_session_id: 'worker-1',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordAuditEvent).toHaveBeenCalledWith(
      'FEAT-LAUNCH',
      'PHASE_AGENT_LAUNCH_RECORDED',
      'builder-agent',
      expect.objectContaining({ launch_mode: 'subagent', manifest_id: context.execution.phase_prompt_manifest!.manifest_id }),
    );
  });

  it('records reduced-fidelity inline execution explicitly', async () => {
    const feature = createFeature();
    const adapter = createAdapter(feature);
    const result = await handleRecordPhaseAgentLaunch(adapter, createSkillAdapter(), createConfig(), {
      feature_id: 'FEAT-LAUNCH',
      phase: '5',
      launch_mode: 'inline_reduced_fidelity',
      launched_by: 'opencode',
      reduced_fidelity_reason: 'Harness cannot spawn subagents.',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordAuditEvent).toHaveBeenCalledWith(
      'FEAT-LAUNCH',
      'PHASE_REDUCED_FIDELITY_RECORDED',
      'builder-agent',
      expect.objectContaining({ reason: 'Harness cannot spawn subagents.' }),
    );
  });
});
