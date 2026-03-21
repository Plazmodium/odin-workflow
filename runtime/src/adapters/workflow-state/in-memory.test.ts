import { describe, expect, it, beforeEach } from 'vitest';

import { InMemoryWorkflowStateAdapter } from './in-memory.js';

describe('InMemoryWorkflowStateAdapter.startAgentInvocation', () => {
  let adapter: InMemoryWorkflowStateAdapter;

  beforeEach(() => {
    adapter = new InMemoryWorkflowStateAdapter();
  });

  it('creates an invocation and completes it with duration', async () => {
    await adapter.startFeature({
      id: 'FEAT-INV',
      name: 'Invocation Test',
      complexity_level: 1,
      severity: 'ROUTINE',
    });

    const invocation = await adapter.startAgentInvocation('FEAT-INV', '3', 'architect-agent', 'Generating spec');
    expect(invocation.id).toBeTruthy();
    expect(invocation.phase).toBe('3');
    expect(invocation.agent_name).toBe('architect-agent');
    expect(invocation.ended_at).toBeNull();
    expect(invocation.duration_ms).toBeNull();

    const completed = await adapter.completeAgentInvocation(invocation.id);
    expect(completed.ended_at).not.toBeNull();
    expect(completed.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('throws when completing a non-existent invocation', async () => {
    await expect(adapter.completeAgentInvocation('inv_nonexistent')).rejects.toThrow('Invocation not found');
  });
});

describe('InMemoryWorkflowStateAdapter.recordPhaseResult', () => {
  let adapter: InMemoryWorkflowStateAdapter;

  beforeEach(async () => {
    adapter = new InMemoryWorkflowStateAdapter();
    await adapter.startFeature({
      id: 'FEAT-TEST',
      name: 'Test Feature',
      complexity_level: 1,
      severity: 'ROUTINE',
    });
    // Advance to phase 5 (Builder) so rework tests make sense
    for (const phase of ['0', '1', '2', '3', '4'] as const) {
      const nextPhase = String(Number(phase) + 1);
      await adapter.recordPhaseResult({
        id: `result_advance_${phase}`,
        feature_id: 'FEAT-TEST',
        phase,
        outcome: 'completed',
        summary: `advance past ${phase}`,
        next_phase: nextPhase as '1' | '2' | '3' | '4' | '5',
        blockers: [],
        created_by: 'tester',
        created_at: new Date().toISOString(),
      });
    }
  });

  it('transitions to next_phase on needs_rework when next_phase is provided', async () => {
    const updated = await adapter.recordPhaseResult({
      id: 'result_rework',
      feature_id: 'FEAT-TEST',
      phase: '5',
      outcome: 'needs_rework',
      summary: 'rework back to Architect',
      next_phase: '3',
      blockers: [],
      created_by: 'tester',
      created_at: new Date().toISOString(),
    });

    expect(updated).not.toBeNull();
    expect(updated!.current_phase).toBe('3');
    expect(updated!.status).toBe('IN_PROGRESS');
  });

  it('stays on current phase on needs_rework when next_phase is omitted', async () => {
    const updated = await adapter.recordPhaseResult({
      id: 'result_rework_stay',
      feature_id: 'FEAT-TEST',
      phase: '5',
      outcome: 'needs_rework',
      summary: 'redo this phase',
      next_phase: null,
      blockers: [],
      created_by: 'tester',
      created_at: new Date().toISOString(),
    });

    expect(updated).not.toBeNull();
    expect(updated!.current_phase).toBe('5');
    expect(updated!.status).toBe('IN_PROGRESS');
  });
});

describe('InMemoryWorkflowStateAdapter.listRelatedLearnings', () => {
  let adapter: InMemoryWorkflowStateAdapter;

  beforeEach(async () => {
    adapter = new InMemoryWorkflowStateAdapter();
    await adapter.startFeature({ id: 'FEAT-A', name: 'Feature A', complexity_level: 1, severity: 'ROUTINE' });
    await adapter.startFeature({ id: 'FEAT-B', name: 'Feature B', complexity_level: 1, severity: 'ROUTINE' });
  });

  it('returns related learnings via shared propagation targets', async () => {
    const learningA = await adapter.captureLearning({
      id: 'learn-a1', feature_id: 'FEAT-A', phase: '3', title: 'A learning',
      content: 'Content A', category: 'PATTERN', tags: ['nextjs'], created_by: 'test', created_at: new Date().toISOString(),
    });
    await adapter.declarePropagationTarget(learningA.id, 'skill', 'frontend/nextjs-dev', 0.8);

    const learningB = await adapter.captureLearning({
      id: 'learn-b1', feature_id: 'FEAT-B', phase: '3', title: 'B learning',
      content: 'Content B', category: 'GOTCHA', tags: ['nextjs'], created_by: 'test', created_at: new Date().toISOString(),
    });
    await adapter.declarePropagationTarget(learningB.id, 'skill', 'frontend/nextjs-dev', 0.7);

    const related = await adapter.listRelatedLearnings('FEAT-A');
    expect(related).toHaveLength(1);
    expect(related[0]!.id).toBe('learn-b1');
    expect(related[0]!.source_feature_id).toBe('FEAT-B');
    expect(related[0]!.shared_domains).toContain('skill:frontend/nextjs-dev');
  });

  it('falls back to tag intersection when no propagation targets exist', async () => {
    await adapter.captureLearning({
      id: 'learn-a2', feature_id: 'FEAT-A', phase: '3', title: 'A learning',
      content: 'Content A', category: 'PATTERN', tags: ['nextjs', 'caching', 'supabase'],
      created_by: 'test', created_at: new Date().toISOString(),
    });
    await adapter.captureLearning({
      id: 'learn-b2', feature_id: 'FEAT-B', phase: '3', title: 'B learning',
      content: 'Content B', category: 'GOTCHA', tags: ['nextjs', 'caching'],
      created_by: 'test', created_at: new Date().toISOString(),
    });

    const related = await adapter.listRelatedLearnings('FEAT-A');
    expect(related).toHaveLength(1);
    expect(related[0]!.id).toBe('learn-b2');
    expect(related[0]!.shared_domains).toContain('nextjs');
    expect(related[0]!.shared_domains).toContain('caching');
  });

  it('returns empty when no learnings exist', async () => {
    const related = await adapter.listRelatedLearnings('FEAT-A');
    expect(related).toHaveLength(0);
  });

  it('does not return learnings from the same feature', async () => {
    const learning = await adapter.captureLearning({
      id: 'learn-a3', feature_id: 'FEAT-A', phase: '3', title: 'A learning',
      content: 'Content A', category: 'PATTERN', tags: ['nextjs'], created_by: 'test', created_at: new Date().toISOString(),
    });
    await adapter.declarePropagationTarget(learning.id, 'skill', 'frontend/nextjs-dev', 0.8);

    const related = await adapter.listRelatedLearnings('FEAT-A');
    expect(related).toHaveLength(0);
  });

  it('respects the limit parameter', async () => {
    const learningA = await adapter.captureLearning({
      id: 'learn-a4', feature_id: 'FEAT-A', phase: '3', title: 'A learning',
      content: 'Content A', category: 'PATTERN', tags: ['nextjs'], created_by: 'test', created_at: new Date().toISOString(),
    });
    await adapter.declarePropagationTarget(learningA.id, 'skill', 'frontend/nextjs-dev', 0.8);

    await adapter.startFeature({ id: 'FEAT-C', name: 'Feature C', complexity_level: 1, severity: 'ROUTINE' });
    for (let i = 0; i < 10; i++) {
      const l = await adapter.captureLearning({
        id: `learn-c${i}`, feature_id: i < 5 ? 'FEAT-B' : 'FEAT-C', phase: '3',
        title: `Learning ${i}`, content: `Content ${i}`, category: 'PATTERN',
        tags: ['nextjs'], created_by: 'test', created_at: new Date().toISOString(),
      });
      await adapter.declarePropagationTarget(l.id, 'skill', 'frontend/nextjs-dev', 0.7);
    }

    const related = await adapter.listRelatedLearnings('FEAT-A', 3);
    expect(related).toHaveLength(3);
  });
});

describe('InMemoryWorkflowStateAdapter watcher lifecycle', () => {
  it('supports claim submission through watcher review', async () => {
    const adapter = new InMemoryWorkflowStateAdapter();
    await adapter.startFeature({
      id: 'FEAT-WATCHER',
      name: 'Watcher Feature',
      complexity_level: 1,
      severity: 'ROUTINE',
      author: 'Jane Doe',
    });

    const claim = await adapter.submitClaim({
      feature_id: 'FEAT-WATCHER',
      phase: '5',
      agent_name: 'builder-agent',
      invocation_id: null,
      claim_type: 'CODE_MODIFIED',
      claim_description: 'Updated payment authorization flow',
      evidence_refs: { commit_sha: 'abc123' },
      risk_level: 'HIGH',
    });

    const policy = await adapter.runPolicyChecks('FEAT-WATCHER');
    expect(policy).toHaveLength(1);
    expect(policy[0]?.verdict).toBe('NEEDS_REVIEW');

    const queue = await adapter.listClaimsNeedingReview('FEAT-WATCHER');
    expect(queue).toHaveLength(1);
    expect(queue[0]?.claim_id).toBe(claim.id);

    await adapter.recordWatcherReview({
      claim_id: claim.id,
      verdict: 'PASS',
      confidence: 0.88,
      reasoning: 'The high-risk change matches the supplied diff and tests.',
      watcher_agent: 'watcher-agent',
    });

    const verification = await adapter.listClaimVerificationStatus('FEAT-WATCHER');
    expect(verification).toHaveLength(1);
    expect(verification[0]).toMatchObject({
      claim_id: claim.id,
      policy_verdict: 'NEEDS_REVIEW',
      watcher_verdict: 'PASS',
      final_status: 'PASS',
    });

    const pending = await adapter.listPendingClaims('FEAT-WATCHER');
    expect(pending).toHaveLength(0);
  });
});
