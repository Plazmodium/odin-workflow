/**
 * Workflow State Adapter Types
 * Version: 0.1.0
 */

import type {
  AgentInvocationRecord,
  ClaimVerificationSummary,
  FeatureCommitRecord,
  FeatureEvalSummary,
  FeatureRecord,
  LearningCategory,
  LearningRecord,
  PersistedTargetType,
  PhaseArtifact,
  PhaseId,
  PhaseResultRecord,
  RelatedLearningRecord,
  ReviewCheckRecord,
  ReviewFinding,
} from '../../types.js';

export interface ListAllLearningsFilter {
  feature_id?: string;
  category?: LearningCategory;
  min_confidence?: number;
}

export interface WorkflowStateAdapter {
  startFeature(feature: Omit<FeatureRecord, 'created_at' | 'updated_at' | 'status' | 'current_phase'>): Promise<FeatureRecord>;
  getFeature(feature_id: string): Promise<FeatureRecord | null>;
  recordPhaseArtifact(artifact: PhaseArtifact): Promise<PhaseArtifact>;
  listPhaseArtifacts(feature_id: string): Promise<PhaseArtifact[]>;
  recordPhaseResult(result: PhaseResultRecord): Promise<FeatureRecord | null>;
  listOpenBlockers(feature_id: string): Promise<string[]>;
  listOpenGates(feature_id: string): Promise<string[]>;
  listOpenFindings(feature_id: string): Promise<string[]>;
  listPendingClaims(feature_id: string): Promise<string[]>;
  listClaimVerificationStatus(feature_id: string): Promise<ClaimVerificationSummary[]>;
  getLatestFeatureEval(feature_id: string): Promise<FeatureEvalSummary | null>;
  recordReviewCheck(check: ReviewCheckRecord): Promise<ReviewCheckRecord>;
  listReviewChecks(feature_id: string): Promise<ReviewCheckRecord[]>;
  captureLearning(learning: LearningRecord): Promise<LearningRecord>;
  listLearnings(feature_id: string): Promise<LearningRecord[]>;
  findOpenAgentInvocation(feature_id: string, phase: PhaseId, agent_name: string): Promise<AgentInvocationRecord | null>;
  startAgentInvocation(feature_id: string, phase: PhaseId, agent_name: string, operation?: string, skills?: string[]): Promise<AgentInvocationRecord>;
  completeAgentInvocation(invocation_id: string): Promise<AgentInvocationRecord>;
  recordCommit(commit: Omit<FeatureCommitRecord, 'committed_at'>): Promise<FeatureCommitRecord>;
  recordPullRequest(feature_id: string, pr_url: string, pr_number: number): Promise<{ feature_id: string; pr_url: string; pr_number: number }>;
  recordMerge(feature_id: string, merged_by: string): Promise<{ feature_id: string; merged_at: string; merged_by: string; pr_url?: string; pr_number?: number }>;
  recordQualityGate(feature_id: string, gate_name: string, status: 'APPROVED' | 'REJECTED', approver: string, notes?: string): Promise<number>;
  computeFeatureEval(feature_id: string): Promise<FeatureEvalSummary | null>;
  recordSecurityFindings(feature_id: string, phase: PhaseId, findings: ReviewFinding[], tool: string): Promise<number>;
  declarePropagationTarget(learning_id: string, target_type: PersistedTargetType, target_path: string | null, relevance: number): Promise<void>;
  listRelatedLearnings(feature_id: string, limit?: number): Promise<RelatedLearningRecord[]>;
  listAllLearnings(filter?: ListAllLearningsFilter): Promise<LearningRecord[]>;
}
