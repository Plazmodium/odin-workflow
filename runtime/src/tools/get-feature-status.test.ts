import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type {
  ClaimVerificationSummary,
  FeatureEvalSummary,
  FeatureRecord,
  LearningRecord,
  PhaseArtifact,
  PhaseResultRecord,
  ReviewCheckRecord,
} from '../types.js';
import { handleGetFeatureStatus } from './get-feature-status.js';

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-002',
    name: 'Feature Status Test',
    status: 'IN_PROGRESS',
    current_phase: '5',
    complexity_level: 2,
    severity: 'ROUTINE',
    branch_name: 'gr/feature/FEAT-002',
    created_at: '2026-03-13T00:00:00.000Z',
    updated_at: '2026-03-13T00:00:00.000Z',
    ...overrides,
  };
}

function createWorkflowAdapter(feature: FeatureRecord | null): WorkflowStateAdapter {
  return {
    startFeature: vi.fn(),
    getFeature: vi.fn(async () => feature),
    recordPhaseArtifact: vi.fn(),
    listPhaseArtifacts: vi.fn(async () => [
      {
        id: 'artifact_1',
        feature_id: 'FEAT-002',
        phase: '3',
        output_type: 'spec',
        content: { approach: ['test'] },
        created_by: 'architect-agent',
        created_at: '2026-03-13T00:00:00.000Z',
      },
    ] as PhaseArtifact[]),
    recordPhaseResult: vi.fn(async () => feature),
    listOpenBlockers: vi.fn(async () => ['Needs approval']),
    listOpenGates: vi.fn(async () => ['guardian_approval [phase 4] (PENDING)']),
    listOpenFindings: vi.fn(async () => ['HIGH: Finding (file.ts)']),
    listPendingClaims: vi.fn(async () => ['CODE_MODIFIED by builder-agent (NEEDS_REVIEW)']),
    listClaimVerificationStatus: vi.fn(async () => [
      {
        claim_id: 'claim_1',
        claim_type: 'CODE_MODIFIED',
        agent_name: 'builder-agent',
        risk_level: 'HIGH',
        policy_verdict: 'NEEDS_REVIEW',
        watcher_verdict: null,
        final_status: 'NEEDS_REVIEW',
      },
      {
        claim_id: 'claim_2',
        claim_type: 'TEST_PASSED',
        agent_name: 'builder-agent',
        risk_level: 'LOW',
        policy_verdict: 'PASS',
        watcher_verdict: null,
        final_status: 'PASS',
      },
    ] as ClaimVerificationSummary[]),
    getLatestFeatureEval: vi.fn(async () => ({
      id: 'eval_1',
      feature_id: 'FEAT-002',
      computed_at: '2026-03-13T01:00:00.000Z',
      efficiency_score: 95,
      quality_score: 100,
      overall_score: 98,
      health_status: 'HEALTHY',
    } as FeatureEvalSummary)),
    recordReviewCheck: vi.fn(),
    listReviewChecks: vi.fn(async () => [
      {
        id: 'review_1',
        feature_id: 'FEAT-002',
        phase: '6',
        tool: 'semgrep',
        status: 'passed',
        summary: '0 findings',
        changed_files: ['src/server.ts'],
        initiated_by: 'reviewer-agent',
        created_at: '2026-03-13T02:00:00.000Z',
      },
    ] as ReviewCheckRecord[]),
    captureLearning: vi.fn(),
    listLearnings: vi.fn(async () => [
      {
        id: 'learning_1',
        feature_id: 'FEAT-002',
        phase: '2',
        title: 'Learned something',
        content: 'Summary text',
        category: 'PATTERN',
        created_by: 'tester',
        created_at: '2026-03-13T03:00:00.000Z',
      },
    ] as LearningRecord[]),
  } as unknown as WorkflowStateAdapter;
}

describe('handleGetFeatureStatus', () => {
  it('returns an error when the feature is missing', async () => {
    const result = await handleGetFeatureStatus(createWorkflowAdapter(null), {
      feature_id: 'MISSING',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('was not found');
  });

  it('returns counts, next phase, latest review check, and latest eval summary', async () => {
    const result = await handleGetFeatureStatus(createWorkflowAdapter(createFeature()), {
      feature_id: 'FEAT-002',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Feature FEAT-002 is IN_PROGRESS in Builder.');
    expect(result.structuredContent?.counts).toEqual({
      artifacts: 1,
      review_checks: 1,
      learnings: 1,
      open_blockers: 1,
      open_gates: 1,
      open_findings: 1,
      pending_claims: 1,
    });
    expect(result.structuredContent?.current_phase?.name).toBe('Builder');
    expect(result.structuredContent?.next_phase?.name).toBe('Reviewer');
    expect(result.structuredContent?.latest_review_check?.summary).toBe('0 findings');
    expect(result.structuredContent?.latest_feature_eval?.overall_score).toBe(98);
    expect(result.structuredContent?.workflow?.claim_verification_summary).toEqual({
      total: 2,
      passed: 1,
      failed: 0,
      needs_review: 1,
      pending: 0,
    });
    expect(result.structuredContent?.claim_verification).toHaveLength(2);
    expect(result.structuredContent?.recent_artifacts).toHaveLength(1);
    expect(result.structuredContent?.recent_learnings).toHaveLength(1);
  });
});
