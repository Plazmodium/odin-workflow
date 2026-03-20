import { describe, expect, it, vi } from 'vitest';

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { FeatureRecord } from '../types.js';
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

describe('handlePreparePhaseContext', () => {
  it('starts a phase invocation with resolved skills when none is open', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      listPhaseArtifacts: vi.fn(async () => []),
      listLearnings: vi.fn(async () => []),
      listRelatedLearnings: vi.fn(async () => []),
      listOpenBlockers: vi.fn(async () => []),
      listOpenGates: vi.fn(async () => []),
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
    expect(result.structuredContent?.context).toMatchObject({
      invocation: {
        id: 'inv_1',
        agent_name: 'builder-agent',
      },
    });
  });
});
