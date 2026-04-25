/**
 * Workflow State Adapter Types
 * Version: 0.1.0
 */

import type {
  AgentInvocationRecord,
  AgentClaimRecord,
  ClaimVerificationSummary,
  FeatureStatus,
  FeatureCommitRecord,
  FeatureEvalSummary,
  FeatureRecord,
  LearningCategory,
  LearningRecord,
  PolicyCheckResult,
  PersistedTargetType,
  PhaseArtifact,
  PhaseExecutionAttestation,
  PhaseId,
  PhasePromptRealizationAttestation,
  PhaseResultRecord,
  QualityGateRecord,
  RelatedLearningRecord,
  ReviewCheckRecord,
  ReviewFinding,
  SkillProposalCandidate,
  SkillProposalRecord,
  SkillProposalReviewStatus,
  SkillProposalStatus,
  WatcherQueueClaim,
  WatcherReviewRecord,
} from '../../types.js';

export interface ListAllLearningsFilter {
  feature_id?: string;
  category?: LearningCategory;
  min_confidence?: number;
}

export interface ListFeaturesFilter {
  statuses?: FeatureStatus[];
}

export interface ListSkillProposalCandidatesFilter {
  statuses?: SkillProposalStatus[];
  limit?: number;
}

export interface ListSkillProposalsFilter {
  statuses?: SkillProposalReviewStatus[];
  limit?: number;
}

export interface WorkflowStateAdapter {
  startFeature(feature: Omit<FeatureRecord, 'created_at' | 'updated_at' | 'status' | 'current_phase'>): Promise<FeatureRecord>;
  getFeature(feature_id: string): Promise<FeatureRecord | null>;
  listFeatures(filter?: ListFeaturesFilter): Promise<FeatureRecord[]>;
  recordPhaseArtifact(artifact: PhaseArtifact): Promise<PhaseArtifact>;
  listPhaseArtifacts(feature_id: string): Promise<PhaseArtifact[]>;
  recordPhaseResult(result: PhaseResultRecord): Promise<FeatureRecord | null>;
  completeFeature(feature_id: string, completed_by: string): Promise<FeatureRecord | null>;
  listOpenBlockers(feature_id: string): Promise<string[]>;
  listOpenGates(feature_id: string): Promise<string[]>;
  listOpenGateRecords(feature_id: string): Promise<QualityGateRecord[]>;
  listOpenFindings(feature_id: string): Promise<string[]>;
  listPendingClaims(feature_id: string): Promise<string[]>;
  listClaimVerificationStatus(feature_id: string): Promise<ClaimVerificationSummary[]>;
  submitClaim(claim: Omit<AgentClaimRecord, 'id' | 'created_at'>): Promise<AgentClaimRecord>;
  runPolicyChecks(feature_id: string): Promise<PolicyCheckResult[]>;
  listClaimsNeedingReview(feature_id?: string): Promise<WatcherQueueClaim[]>;
  recordWatcherReview(review: Omit<WatcherReviewRecord, 'id' | 'reviewed_at'>): Promise<WatcherReviewRecord>;
  getLatestFeatureEval(feature_id: string): Promise<FeatureEvalSummary | null>;
  recordReviewCheck(check: ReviewCheckRecord): Promise<ReviewCheckRecord>;
  listReviewChecks(feature_id: string): Promise<ReviewCheckRecord[]>;
  captureLearning(learning: LearningRecord): Promise<LearningRecord>;
  listLearnings(feature_id: string): Promise<LearningRecord[]>;
  listAgentInvocations(feature_id: string): Promise<AgentInvocationRecord[]>;
  findOpenAgentInvocation(feature_id: string, phase: PhaseId, agent_name: string): Promise<AgentInvocationRecord | null>;
  startAgentInvocation(feature_id: string, phase: PhaseId, agent_name: string, operation?: string, skills?: string[]): Promise<AgentInvocationRecord>;
  completeAgentInvocation(invocation_id: string): Promise<AgentInvocationRecord>;
  registerPhaseExecution(attestation: PhaseExecutionAttestation): Promise<PhaseExecutionAttestation>;
  clearPhaseExecutionAttestation(feature_id: string, phase: PhaseId): Promise<void>;
  getPhaseExecutionAttestation(feature_id: string, phase: PhaseId): Promise<PhaseExecutionAttestation | null>;
  listPhaseExecutionAttestations(feature_id: string): Promise<PhaseExecutionAttestation[]>;
  registerPhasePromptRealization(attestation: PhasePromptRealizationAttestation): Promise<PhasePromptRealizationAttestation>;
  getPhasePromptRealization(feature_id: string, phase: PhaseId): Promise<PhasePromptRealizationAttestation | null>;
  listPhasePromptRealizations(feature_id: string): Promise<PhasePromptRealizationAttestation[]>;
  recordCommit(commit: Omit<FeatureCommitRecord, 'committed_at'>): Promise<FeatureCommitRecord>;
  recordPullRequest(feature_id: string, pr_url: string, pr_number: number): Promise<{ feature_id: string; pr_url: string; pr_number: number }>;
  recordMerge(feature_id: string, merged_by: string): Promise<{ feature_id: string; merged_at: string; merged_by: string; pr_url?: string; pr_number?: number }>;
  recordAuditEvent(feature_id: string | null, operation: string, agent_name: string, details?: Record<string, unknown>): Promise<void>;
  recordQualityGate(
    feature_id: string,
    gate_name: string,
    status: 'APPROVED' | 'REJECTED',
    approver: string,
    notes?: string,
    phase?: PhaseId
  ): Promise<number>;
  computeFeatureEval(feature_id: string): Promise<FeatureEvalSummary | null>;
  recordSecurityFindings(feature_id: string, phase: PhaseId, findings: ReviewFinding[], tool: string): Promise<number>;
  declarePropagationTarget(learning_id: string, target_type: PersistedTargetType, target_path: string | null, relevance: number): Promise<void>;
  listRelatedLearnings(feature_id: string, limit?: number): Promise<RelatedLearningRecord[]>;
  listAllLearnings(filter?: ListAllLearningsFilter): Promise<LearningRecord[]>;
  replaceSkillProposalCandidates(candidates: SkillProposalCandidate[]): Promise<void>;
  listSkillProposalCandidates(filter?: ListSkillProposalCandidatesFilter): Promise<SkillProposalCandidate[]>;
  upsertSkillProposalDraft(proposal: Omit<SkillProposalRecord, 'created_at' | 'updated_at' | 'approved_by' | 'approved_at' | 'published_by' | 'published_at'>): Promise<SkillProposalRecord>;
  listSkillProposals(filter?: ListSkillProposalsFilter): Promise<SkillProposalRecord[]>;
  recordSkillProposalDecision(topic_key: string, status: 'APPROVED' | 'REJECTED', actor: string, notes?: string): Promise<SkillProposalRecord>;
  markSkillProposalPublished(topic_key: string, published_by: string, published_path: string): Promise<SkillProposalRecord>;
}
