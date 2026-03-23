import { describe, expect, it, vi } from 'vitest';

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
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
    author: 'Jane Doe',
    created_at: '2026-03-20T00:00:00.000Z',
    updated_at: '2026-03-20T00:00:00.000Z',
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
    };

    const result = await handlePreparePhaseContext(adapter, skillAdapter, {
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
          agent: { constraints: string[] };
          verification: { required_checks: string[] };
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
        required_checks: ['build', 'tests'],
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
    expect(context?.agent.constraints).toContain(
      'Development Evals are required: the open `eval_readiness` gate is REJECTED. Respect that gate and escalate instead of bypassing it.'
    );
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
    };

    const result = await handlePreparePhaseContext(adapter, skillAdapter, {
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
          development_evals: {
            latest_plan: { output_type: string } | null;
            status_summary: string[];
          };
        };
      }
    )?.context;

    expect(context?.artifacts).toEqual({});
    expect(context?.development_evals.latest_plan).toMatchObject({ output_type: 'eval_plan' });
    expect(context?.development_evals.status_summary).toContain(
      'Latest eval_plan recorded by agent at 2026-03-20T00:30:00.000Z.'
    );
  });
});
