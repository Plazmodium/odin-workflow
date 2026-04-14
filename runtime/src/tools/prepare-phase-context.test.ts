import { describe, expect, it, vi } from 'vitest';

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import type { FeatureRecord, PhaseArtifact } from '../types.js';
import { handlePreparePhaseContext } from './prepare-phase-context.js';

function createFeature(): FeatureRecord {
  return {
    id: 'FEAT-CTX',
    name: 'Context Feature',
    status: 'IN_PROGRESS',
    current_phase: '5',
    complexity_level: 2,
    severity: 'ROUTINE',
    base_branch: 'main',
    author: 'Jane Doe',
    created_at: '2026-03-20T00:00:00.000Z',
    updated_at: '2026-03-20T00:00:00.000Z',
  };
}

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

function createArtifact(output_type: PhaseArtifact['output_type'], created_at: string, content: unknown): PhaseArtifact {
  return {
    id: `artifact_${output_type}_${created_at}`,
    feature_id: 'FEAT-CTX',
    phase: output_type === 'eval_run' ? '6' : '3',
    output_type,
    content,
    created_by: 'agent',
    created_at,
  };
}

describe('handlePreparePhaseContext', () => {
  it('starts a phase invocation with resolved skills and exposes development eval context', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      listPhaseArtifacts: vi.fn(async () => [
        createArtifact('eval_plan', '2026-03-20T00:30:00.000Z', { cases: ['cap-1'] }),
        createArtifact('eval_run', '2026-03-20T00:45:00.000Z', { status: 'partial' }),
      ]),
      listLearnings: vi.fn(async () => []),
      listRelatedLearnings: vi.fn(async () => []),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGateRecords: vi.fn(async () => [
        {
          id: 0,
          feature_id: 'FEAT-CTX',
          gate_name: 'eval_readiness',
          phase: '4',
          status: 'PENDING',
          approver: 'guardian-agent',
          approved_at: '2026-03-20T00:40:00.000Z',
          approval_notes: 'Older gate state.',
        },
        {
          id: 1,
          feature_id: 'FEAT-CTX',
          gate_name: 'eval_readiness',
          phase: '4',
          status: 'REJECTED',
          approver: 'guardian-agent',
          approved_at: '2026-03-20T00:50:00.000Z',
          approval_notes: 'Needs clearer regression coverage.',
        },
      ]),
      listOpenFindings: vi.fn(async () => []),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => [
        {
          claim_id: 'claim_1',
          claim_type: 'CODE_MODIFIED',
          agent_name: 'builder-agent',
          risk_level: 'LOW',
          policy_verdict: 'NEEDS_REVIEW',
          watcher_verdict: null,
          final_status: 'NEEDS_REVIEW',
        },
      ]),
      listClaimsNeedingReview: vi.fn(async () => [
        {
          claim_id: 'claim_1',
          feature_id: 'FEAT-CTX',
          phase: '5',
          agent_name: 'builder-agent',
          claim_type: 'CODE_MODIFIED',
          claim_description: 'Changed endpoint handlers',
          evidence_refs: {},
          risk_level: 'LOW',
          policy_verdict: 'NEEDS_REVIEW',
          policy_reason: 'Missing evidence references - escalate to watcher',
          created_at: '2026-03-20T00:58:00.000Z',
        },
      ]),
      findOpenAgentInvocation: vi.fn(async () => null),
      startAgentInvocation: vi.fn(async () => ({
        id: 'inv_1',
        feature_id: 'FEAT-CTX',
        phase: '5',
        agent_name: 'builder-agent',
        operation: 'Phase 5: Builder',
        skills_used: ['testing/unit-tests-sdd', 'testing/vitest'],
        started_at: '2026-03-20T01:00:00.000Z',
        ended_at: null,
        duration_ms: null,
      })),
    } as unknown as WorkflowStateAdapter;

    const skillAdapter: SkillAdapter = {
      resolveSkills: vi.fn(async () => ({
        resolved: [
          { name: 'unit-tests-sdd', category: 'testing', source: 'built_in' as const, content: 'builder tests' },
          { name: 'vitest', category: 'testing', source: 'built_in' as const, content: 'vitest skill' },
        ],
        fallback_used: false,
      })),
      listKnowledgeDomains: vi.fn(async () => []),
      invalidateCaches: vi.fn(),
    };

    const result = await handlePreparePhaseContext(adapter, skillAdapter, createConfig('auto_pr'), {
      feature_id: 'FEAT-CTX',
      phase: '5',
      include_artifacts: true,
      include_skills: true,
      include_learnings: true,
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.startAgentInvocation).toHaveBeenCalledWith(
      'FEAT-CTX',
      '5',
      'builder-agent',
      'Phase 5: Builder',
      ['testing/unit-tests-sdd', 'testing/vitest']
    );
    const context = (
      result.structuredContent as {
        context?: {
          agent: { name: string; constraints: string[] };
          automation: {
            configured_mode: string;
            next_human_boundary: string;
            capabilities: { can_open_pr: boolean };
            blocking_reasons: string[];
          };
          execution: {
            actor_model: string;
            execution_owner: string;
            phase_role_name: string;
            acting_agent_name: string;
            child_agent_role: string;
            supported_modes: string[];
            recommended_mode: string;
            child_state_strategy: string;
            prompt_sections: string[];
          };
          verification: { required_checks: string[] };
          workflow: { claims_needing_review_count: number };
          development_evals: {
            expected_artifacts: string[];
            open_readiness_gate: { status: string } | null;
            requirements: string[];
            status_summary: string[];
            harness_prompt_block: string[];
          };
        };
      }
    )?.context;

    expect(context).toMatchObject({
      agent: {
        name: 'builder-agent',
      },
      automation: {
        configured_mode: 'auto_pr',
        next_human_boundary: 'pr',
        capabilities: {
          can_open_pr: false,
        },
      },
      execution: {
        actor_model: 'logical_role',
        execution_owner: 'harness',
        phase_role_name: 'builder-agent',
        acting_agent_name: 'builder-agent',
        child_agent_role: 'acts_as_phase_role',
        supported_modes: ['inline', 'subagent'],
        recommended_mode: 'subagent',
        child_state_strategy: 'direct_odin_tools_if_available',
      },
      development_evals: {
        mode: 'plan_required',
        latest_plan: {
          output_type: 'eval_plan',
        },
        latest_run: {
          output_type: 'eval_run',
        },
        expected_artifacts: [],
        open_readiness_gate: {
          status: 'REJECTED',
        },
      },
      invocation: {
        id: 'inv_1',
        agent_name: 'builder-agent',
      },
      verification: {
        required_checks: ['build', 'tests', 'policy checks', 'watcher review resolution'],
      },
      workflow: {
        claims_needing_review_count: 1,
      },
    });
    expect(context?.development_evals.requirements).toContain(
      'Implement against the eval_plan; eval coverage does not replace real tests.'
    );
    expect(context?.development_evals.status_summary).toContain('Latest eval_run status is partial.');
    expect(context?.development_evals.status_summary).toContain('Open eval_readiness gate is REJECTED in phase 4.');
    expect(context?.development_evals.harness_prompt_block).toContain(
      'Development Evals are required: the open `eval_readiness` gate is REJECTED. Respect that gate and escalate instead of bypassing it.'
    );
    expect(context?.automation.blocking_reasons).toContain('2 open quality gate(s) still need resolution');
    expect(context?.automation.blocking_reasons).toContain('1 claim(s) still require watcher resolution');
    expect(context?.agent.constraints).toContain(
      'Development Evals are required: the open `eval_readiness` gate is REJECTED. Respect that gate and escalate instead of bypassing it.'
    );
    expect(context?.agent.constraints).toContain(
      'Outstanding claims need watcher review: call odin.get_claims_needing_review, have watcher-agent review each claim, record results with odin.record_watcher_review, then re-run odin.verify_claims before closing the watched phase.'
    );
    expect(context?.execution.prompt_sections).toEqual([
      'phase',
      'role_summary',
      'constraints',
      'development_evals',
      'automation',
      'verification',
      'workflow',
      'artifacts',
      'skills',
      'learnings',
    ]);
  });

  it('retains development eval artifact context even when include_artifacts is false', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      listPhaseArtifacts: vi.fn(async () => [
        createArtifact('eval_plan', '2026-03-20T00:30:00.000Z', { cases: ['cap-1'] }),
      ]),
      listLearnings: vi.fn(async () => []),
      listRelatedLearnings: vi.fn(async () => []),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGateRecords: vi.fn(async () => []),
      listOpenFindings: vi.fn(async () => []),
      listPendingClaims: vi.fn(async () => []),
      listClaimVerificationStatus: vi.fn(async () => []),
      listClaimsNeedingReview: vi.fn(async () => []),
      findOpenAgentInvocation: vi.fn(async () => null),
      startAgentInvocation: vi.fn(async () => ({
        id: 'inv_2',
        feature_id: 'FEAT-CTX',
        phase: '5',
        agent_name: 'builder-agent',
        operation: 'Phase 5: Builder',
        skills_used: [],
        started_at: '2026-03-20T01:10:00.000Z',
        ended_at: null,
        duration_ms: null,
      })),
    } as unknown as WorkflowStateAdapter;

    const skillAdapter: SkillAdapter = {
      resolveSkills: vi.fn(async () => ({
        resolved: [],
        fallback_used: true,
      })),
      listKnowledgeDomains: vi.fn(async () => []),
      invalidateCaches: vi.fn(),
    };

    const result = await handlePreparePhaseContext(adapter, skillAdapter, createConfig('guarded'), {
      feature_id: 'FEAT-CTX',
      phase: '5',
      include_artifacts: false,
      include_skills: false,
      include_learnings: false,
    });

    const context = (
      result.structuredContent as {
        context?: {
          artifacts: Record<string, unknown>;
          automation: {
            configured_mode: string;
            blocking_reasons: string[];
          };
          development_evals: {
            latest_plan: { output_type: string } | null;
            status_summary: string[];
          };
        };
      }
    )?.context;

    expect(context?.artifacts).toEqual({});
    expect(context?.automation.configured_mode).toBe('guarded');
    expect(context?.automation.blocking_reasons).toContain(
      'automation.mode is guarded; human approval is required before PR creation'
    );
    expect(context?.development_evals.latest_plan).toMatchObject({ output_type: 'eval_plan' });
    expect(context?.development_evals.status_summary).toContain(
      'Latest eval_plan recorded by agent at 2026-03-20T00:30:00.000Z.'
    );
  });

  it('keeps the canonical phase role stable when a custom acting agent name is provided', async () => {
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
      findOpenAgentInvocation: vi.fn(async () => null),
      startAgentInvocation: vi.fn(async () => ({
        id: 'inv_custom',
        feature_id: 'FEAT-CTX',
        phase: '5',
        agent_name: 'senior-builder',
        operation: 'Phase 5: Builder',
        skills_used: [],
        started_at: '2026-03-20T01:20:00.000Z',
        ended_at: null,
        duration_ms: null,
      })),
    } as unknown as WorkflowStateAdapter;

    const skillAdapter: SkillAdapter = {
      resolveSkills: vi.fn(async () => ({
        resolved: [],
        fallback_used: false,
      })),
      listKnowledgeDomains: vi.fn(async () => []),
      invalidateCaches: vi.fn(),
    };

    const result = await handlePreparePhaseContext(adapter, skillAdapter, createConfig('guarded'), {
      feature_id: 'FEAT-CTX',
      phase: '5',
      agent_name: 'senior-builder',
      include_artifacts: false,
      include_skills: true,
      include_learnings: false,
    });

    const context = (
      result.structuredContent as {
        context?: {
          agent: { name: string };
          execution: {
            phase_role_name: string;
            acting_agent_name: string;
            recommended_mode: string;
          };
          invocation: { agent_name: string } | null;
        };
      }
    )?.context;

    expect(adapter.startAgentInvocation).toHaveBeenCalledWith(
      'FEAT-CTX',
      '5',
      'senior-builder',
      'Phase 5: Builder',
      undefined
    );
    expect(context?.agent.name).toBe('builder-agent');
    expect(context?.execution.phase_role_name).toBe('builder-agent');
    expect(context?.execution.acting_agent_name).toBe('senior-builder');
    expect(context?.execution.recommended_mode).toBe('subagent');
    expect(context?.invocation?.agent_name).toBe('senior-builder');
  });
});
