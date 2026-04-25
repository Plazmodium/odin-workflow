/**
 * In-Memory Workflow State Adapter
 * Version: 0.1.0
 */

import { randomUUID } from 'node:crypto';

import { getNextPhaseId } from '../../domain/phases.js';
import { formatOpenGateSummary } from '../../domain/quality-gates.js';
import type {
  AgentInvocationRecord,
  AgentClaimRecord,
  ClaimVerificationSummary,
  FeatureCommitRecord,
  FeatureEvalSummary,
  FeatureRecord,
  LearningRecord,
  PolicyCheckResult,
  PolicyVerdictRecord,
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
  VerificationStatus,
  WatcherQueueClaim,
  WatcherReviewRecord,
} from '../../types.js';
import type {
  ListAllLearningsFilter,
  ListFeaturesFilter,
  ListSkillProposalCandidatesFilter,
  ListSkillProposalsFilter,
  WorkflowStateAdapter,
} from './types.js';

export class InMemoryWorkflowStateAdapter implements WorkflowStateAdapter {
  private readonly features = new Map<string, FeatureRecord>();
  private readonly artifacts = new Map<string, PhaseArtifact[]>();
  private readonly results = new Map<string, PhaseResultRecord[]>();
  private readonly review_checks = new Map<string, ReviewCheckRecord[]>();
  private readonly learnings = new Map<string, LearningRecord[]>();
  private readonly commits = new Map<string, FeatureCommitRecord[]>();
  private readonly quality_gates = new Map<string, QualityGateRecord[]>();
  private readonly claims = new Map<string, AgentClaimRecord[]>();
  private readonly policy_verdicts = new Map<string, PolicyVerdictRecord[]>();
  private readonly watcher_reviews = new Map<string, WatcherReviewRecord[]>();
  private readonly invocations = new Map<string, AgentInvocationRecord>();
  private readonly execution_attestations = new Map<string, PhaseExecutionAttestation>();
  private readonly prompt_realizations = new Map<string, PhasePromptRealizationAttestation>();
  private readonly propagation_targets: Array<{ learning_id: string; target_type: PersistedTargetType; target_path: string | null; relevance: number }> = [];
  private readonly skill_proposals = new Map<string, SkillProposalCandidate>();
  private readonly skill_proposal_records = new Map<string, SkillProposalRecord>();
  private invocation_counter = 0;

  async startFeature(
    feature: Omit<FeatureRecord, 'created_at' | 'updated_at' | 'status' | 'current_phase'>
  ): Promise<FeatureRecord> {
    const now = new Date().toISOString();
    const record: FeatureRecord = {
      ...feature,
      status: 'IN_PROGRESS',
      current_phase: '0',
      completed_at: undefined,
      created_at: now,
      updated_at: now,
    };

    this.features.set(record.id, record);

    return record;
  }

  async getFeature(feature_id: string): Promise<FeatureRecord | null> {
    return this.features.get(feature_id) ?? null;
  }

  async listFeatures(filter?: ListFeaturesFilter): Promise<FeatureRecord[]> {
    const statuses = filter?.statuses;

    return Array.from(this.features.values())
      .filter((feature) => statuses == null || statuses.length === 0 || statuses.includes(feature.status))
      .sort((left, right) => left.created_at.localeCompare(right.created_at));
  }

  async recordPhaseArtifact(artifact: PhaseArtifact): Promise<PhaseArtifact> {
    const existing = this.artifacts.get(artifact.feature_id) ?? [];
    const filtered = existing.filter(
      (current) => !(current.phase === artifact.phase && current.output_type === artifact.output_type)
    );
    this.artifacts.set(artifact.feature_id, [...filtered, artifact]);
    this.touchFeature(artifact.feature_id);
    return artifact;
  }

  async listPhaseArtifacts(feature_id: string): Promise<PhaseArtifact[]> {
    return [...(this.artifacts.get(feature_id) ?? [])];
  }

  async recordPhaseResult(result: PhaseResultRecord): Promise<FeatureRecord | null> {
    const feature = this.features.get(result.feature_id);
    if (feature == null) {
      return null;
    }

    const existing = this.results.get(result.feature_id) ?? [];
    this.results.set(result.feature_id, [...existing, result]);

    if (result.outcome === 'completed' && result.phase === '9' && result.next_phase === '10') {
      return this.completeFeature(result.feature_id, result.created_by);
    }

    let next_status = feature.status;
    let next_phase = feature.current_phase;

    if (result.outcome === 'blocked') {
      next_status = 'BLOCKED';
    } else if (result.outcome === 'needs_rework') {
      next_status = 'IN_PROGRESS';
      next_phase = result.next_phase ?? result.phase;
    } else {
      next_status = result.next_phase === '10' || result.phase === '10' ? 'COMPLETED' : 'IN_PROGRESS';
      next_phase = result.next_phase ?? getNextPhaseId(result.phase) ?? result.phase;
    }

    const updated: FeatureRecord = {
      ...feature,
      status: next_status,
      current_phase: next_phase,
      updated_at: new Date().toISOString(),
    };

    this.features.set(result.feature_id, updated);

    return updated;
  }

  async completeFeature(feature_id: string, _completed_by: string): Promise<FeatureRecord | null> {
    const feature = this.features.get(feature_id);
    if (feature == null) {
      return null;
    }

    const completed_phases = new Set(
      Array.from(this.invocations.values())
        .filter(
          (invocation) =>
            invocation.feature_id === feature_id && invocation.ended_at != null && invocation.duration_ms != null
        )
        .map((invocation) => invocation.phase)
    );
    const expected_phases: PhaseId[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    if (expected_phases.some((phase) => !completed_phases.has(phase))) {
      const blocked: FeatureRecord = {
        ...feature,
        status: 'BLOCKED',
        updated_at: new Date().toISOString(),
      };

      this.features.set(feature_id, blocked);
      return blocked;
    }

    const completed: FeatureRecord = {
      ...feature,
      status: 'COMPLETED',
      current_phase: '10',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.features.set(feature_id, completed);
    return completed;
  }

  async listOpenBlockers(_feature_id: string): Promise<string[]> {
    return [];
  }

  async listOpenGates(_feature_id: string): Promise<string[]> {
    const gates = await this.listOpenGateRecords(_feature_id);
    return gates.map(formatOpenGateSummary);
  }

  async listOpenGateRecords(feature_id: string): Promise<QualityGateRecord[]> {
    return [...(this.quality_gates.get(feature_id) ?? [])].filter(
      (gate) => gate.status === 'PENDING' || gate.status === 'REJECTED'
    );
  }

  async listOpenFindings(_feature_id: string): Promise<string[]> {
    return [];
  }

  async listPendingClaims(_feature_id: string): Promise<string[]> {
    const claims = this.claims.get(_feature_id) ?? [];

    return claims
      .map((claim) => {
        const review = this.getLatestWatcherReview(claim.id);
        const verdict = this.getLatestPolicyVerdict(claim.id);

        if (review != null && review.verdict === 'PASS') {
          return null;
        }

        if (review != null && review.verdict === 'FAIL') {
          return `${claim.claim_type} by ${claim.agent_name} (watcher FAIL)`;
        }

        if (verdict == null) {
          return `${claim.claim_type} by ${claim.agent_name} (pending policy)`;
        }

        if (verdict.verdict === 'PASS') {
          return null;
        }

        return `${claim.claim_type} by ${claim.agent_name} (${verdict.verdict})`;
      })
      .filter((value): value is string => value != null);
  }

  async listClaimVerificationStatus(feature_id: string): Promise<ClaimVerificationSummary[]> {
    const claims = this.claims.get(feature_id) ?? [];

    return claims.map((claim) => {
      const policy = this.getLatestPolicyVerdict(claim.id);
      const watcher = this.getLatestWatcherReview(claim.id);
      const final_status: VerificationStatus = watcher?.verdict ?? policy?.verdict ?? 'PENDING';

      return {
        claim_id: claim.id,
        claim_type: claim.claim_type,
        agent_name: claim.agent_name,
        risk_level: claim.risk_level,
        policy_verdict: policy?.verdict ?? null,
        watcher_verdict: watcher?.verdict ?? null,
        final_status,
      };
    });
  }

  async submitClaim(claim: Omit<AgentClaimRecord, 'id' | 'created_at'>): Promise<AgentClaimRecord> {
    const record: AgentClaimRecord = {
      ...claim,
      id: randomUUID(),
      created_at: new Date().toISOString(),
    };

    const existing = this.claims.get(claim.feature_id) ?? [];
    this.claims.set(claim.feature_id, [...existing, record]);
    this.touchFeature(claim.feature_id);

    return record;
  }

  async runPolicyChecks(feature_id: string): Promise<PolicyCheckResult[]> {
    const claims = this.claims.get(feature_id) ?? [];
    const results: PolicyCheckResult[] = [];

    for (const claim of claims) {
      if (this.getLatestPolicyVerdict(claim.id) != null) {
        continue;
      }

      const has_evidence = Object.keys(claim.evidence_refs).length > 0;
      const verdict: VerificationStatus = !has_evidence || claim.risk_level === 'HIGH' ? 'NEEDS_REVIEW' : 'PASS';
      const reason = !has_evidence
        ? 'Missing evidence references - escalate to watcher'
        : claim.risk_level === 'HIGH'
          ? 'High risk claim - requires watcher review'
          : 'Evidence references present';

      this.recordPolicyVerdictInternal(claim.id, verdict, 'evidence_check', reason, claim.evidence_refs);
      results.push({
        claim_id: claim.id,
        claim_type: claim.claim_type,
        verdict,
        needs_watcher: verdict === 'NEEDS_REVIEW',
      });
    }

    return results;
  }

  async listClaimsNeedingReview(feature_id?: string): Promise<WatcherQueueClaim[]> {
    const claims = feature_id == null
      ? Array.from(this.claims.values()).flat()
      : this.claims.get(feature_id) ?? [];

    return claims
      .filter((claim) => {
        const policy = this.getLatestPolicyVerdict(claim.id);
        const watcher = this.getLatestWatcherReview(claim.id);
        return watcher == null && (claim.risk_level === 'HIGH' || policy?.verdict === 'NEEDS_REVIEW');
      })
      .map((claim) => {
        const policy = this.getLatestPolicyVerdict(claim.id);
        return {
          claim_id: claim.id,
          feature_id: claim.feature_id,
          phase: claim.phase,
          agent_name: claim.agent_name,
          claim_type: claim.claim_type,
          claim_description: claim.claim_description,
          evidence_refs: claim.evidence_refs,
          risk_level: claim.risk_level,
          policy_verdict: policy?.verdict ?? null,
          policy_reason: policy?.reason ?? null,
          created_at: claim.created_at,
        };
      })
      .sort((left, right) => {
        if (left.risk_level !== right.risk_level) {
          return left.risk_level === 'HIGH' ? -1 : 1;
        }

        return left.created_at.localeCompare(right.created_at);
      });
  }

  async recordWatcherReview(review: Omit<WatcherReviewRecord, 'id' | 'reviewed_at'>): Promise<WatcherReviewRecord> {
    const claim = this.findClaim(review.claim_id);
    if (claim == null) {
      throw new Error(`Claim not found: ${review.claim_id}`);
    }

    const record: WatcherReviewRecord = {
      ...review,
      id: randomUUID(),
      reviewed_at: new Date().toISOString(),
    };

    const existing = this.watcher_reviews.get(review.claim_id) ?? [];
    this.watcher_reviews.set(review.claim_id, [...existing, record]);
    this.touchFeature(claim.feature_id);

    return record;
  }

  async getLatestFeatureEval(_feature_id: string): Promise<FeatureEvalSummary | null> {
    return null;
  }

  async recordReviewCheck(check: ReviewCheckRecord): Promise<ReviewCheckRecord> {
    const existing = this.review_checks.get(check.feature_id) ?? [];
    this.review_checks.set(check.feature_id, [...existing, check]);
    this.touchFeature(check.feature_id);
    return check;
  }

  async listReviewChecks(feature_id: string): Promise<ReviewCheckRecord[]> {
    return [...(this.review_checks.get(feature_id) ?? [])];
  }

  async captureLearning(learning: LearningRecord): Promise<LearningRecord> {
    const existing = this.learnings.get(learning.feature_id) ?? [];
    this.learnings.set(learning.feature_id, [...existing, learning]);
    this.touchFeature(learning.feature_id);
    return learning;
  }

  async listLearnings(feature_id: string): Promise<LearningRecord[]> {
    return [...(this.learnings.get(feature_id) ?? [])];
  }

  async listAgentInvocations(feature_id: string): Promise<AgentInvocationRecord[]> {
    return Array.from(this.invocations.values()).filter((invocation) => invocation.feature_id === feature_id);
  }

  async findOpenAgentInvocation(
    feature_id: string,
    phase: PhaseId,
    agent_name: string
  ): Promise<AgentInvocationRecord | null> {
    const matching = Array.from(this.invocations.values())
      .filter(
        (record) =>
          record.feature_id === feature_id &&
          record.phase === phase &&
          record.agent_name === agent_name &&
          record.ended_at == null
      )
      .sort((left, right) => right.started_at.localeCompare(left.started_at));

    return matching[0] ?? null;
  }

  async startAgentInvocation(
    feature_id: string,
    phase: PhaseId,
    agent_name: string,
    operation?: string,
    skills?: string[]
  ): Promise<AgentInvocationRecord> {
    this.invocation_counter++;
    const record: AgentInvocationRecord = {
      id: `inv_${this.invocation_counter}`,
      feature_id,
      phase,
      agent_name,
      operation: operation ?? null,
      skills_used: skills ?? [],
      started_at: new Date().toISOString(),
      ended_at: null,
      duration_ms: null,
    };

    this.invocations.set(record.id, record);
    return record;
  }

  async completeAgentInvocation(invocation_id: string): Promise<AgentInvocationRecord> {
    const record = this.invocations.get(invocation_id);
    if (record == null || record.ended_at != null) {
      throw new Error(`Invocation not found or already ended: ${invocation_id}`);
    }

    const ended_at = new Date();
    const started_at = new Date(record.started_at);
    const updated: AgentInvocationRecord = {
      ...record,
      ended_at: ended_at.toISOString(),
      duration_ms: ended_at.getTime() - started_at.getTime(),
    };

    this.invocations.set(invocation_id, updated);
    return updated;
  }

  async registerPhaseExecution(attestation: PhaseExecutionAttestation): Promise<PhaseExecutionAttestation> {
    this.execution_attestations.set(`${attestation.feature_id}:${attestation.phase}`, attestation);
    this.touchFeature(attestation.feature_id);
    return attestation;
  }

  async clearPhaseExecutionAttestation(feature_id: string, phase: PhaseId): Promise<void> {
    this.execution_attestations.delete(`${feature_id}:${phase}`);
    this.touchFeature(feature_id);
  }

  async getPhaseExecutionAttestation(feature_id: string, phase: PhaseId): Promise<PhaseExecutionAttestation | null> {
    return this.execution_attestations.get(`${feature_id}:${phase}`) ?? null;
  }

  async listPhaseExecutionAttestations(feature_id: string): Promise<PhaseExecutionAttestation[]> {
    return Array.from(this.execution_attestations.values())
      .filter((attestation) => attestation.feature_id === feature_id)
      .sort((left, right) => left.phase.localeCompare(right.phase, undefined, { numeric: true }));
  }

  async registerPhasePromptRealization(attestation: PhasePromptRealizationAttestation): Promise<PhasePromptRealizationAttestation> {
    this.prompt_realizations.set(`${attestation.feature_id}:${attestation.phase}`, attestation);
    this.touchFeature(attestation.feature_id);
    return attestation;
  }

  async getPhasePromptRealization(feature_id: string, phase: PhaseId): Promise<PhasePromptRealizationAttestation | null> {
    return this.prompt_realizations.get(`${feature_id}:${phase}`) ?? null;
  }

  async listPhasePromptRealizations(feature_id: string): Promise<PhasePromptRealizationAttestation[]> {
    return Array.from(this.prompt_realizations.values())
      .filter((attestation) => attestation.feature_id === feature_id)
      .sort((left, right) => left.phase.localeCompare(right.phase, undefined, { numeric: true }));
  }

  async recordCommit(commit: Omit<FeatureCommitRecord, 'committed_at'>): Promise<FeatureCommitRecord> {
    const record: FeatureCommitRecord = {
      ...commit,
      committed_at: new Date().toISOString(),
    };

    const existing = this.commits.get(commit.feature_id) ?? [];
    this.commits.set(commit.feature_id, [...existing, record]);
    return record;
  }

  async recordPullRequest(
    feature_id: string,
    pr_url: string,
    pr_number: number
  ): Promise<{ feature_id: string; pr_url: string; pr_number: number }> {
    const feature = this.features.get(feature_id);
    if (feature != null) {
      this.features.set(feature_id, {
        ...feature,
        pr_url,
        pr_number,
        updated_at: new Date().toISOString(),
      });
    }

    return { feature_id, pr_url, pr_number };
  }

  async recordMerge(
    feature_id: string,
    merged_by: string
  ): Promise<{ feature_id: string; merged_at: string; merged_by: string; pr_url?: string; pr_number?: number }> {
    const merged_at = new Date().toISOString();
    const feature = this.features.get(feature_id);
    if (feature != null) {
      this.features.set(feature_id, {
        ...feature,
        merged_at,
        updated_at: merged_at,
      });
    }

    return {
      feature_id,
      merged_at,
      merged_by,
      pr_url: feature?.pr_url,
      pr_number: feature?.pr_number,
    };
  }

  async recordAuditEvent(
    _feature_id: string | null,
    _operation: string,
    _agent_name: string,
    _details?: Record<string, unknown>
  ): Promise<void> {}

  async recordQualityGate(
    feature_id: string,
    gate_name: string,
    status: 'APPROVED' | 'REJECTED',
    approver: string,
    notes?: string,
    phase?: PhaseId
  ): Promise<number> {
    const feature = this.features.get(feature_id);
    if (feature == null) {
      throw new Error(`Feature ${feature_id} not found`);
    }

    const effective_phase = phase ?? feature.current_phase;
    const existing = this.quality_gates.get(feature_id) ?? [];
    const duplicate = existing.find(
      (gate) => gate.gate_name === gate_name && gate.phase === effective_phase
    );
    const gate_id = duplicate?.id ?? existing.length + 1;
    const next_gate: QualityGateRecord = {
      id: gate_id,
      feature_id,
      gate_name,
      phase: effective_phase,
      status,
      approver,
      approved_at: new Date().toISOString(),
      approval_notes: notes ?? null,
    };

    const filtered = existing.filter((gate) => !(gate.gate_name === gate_name && gate.phase === effective_phase));
    this.quality_gates.set(feature_id, [...filtered, next_gate]);
    this.touchFeature(feature_id);
    return gate_id;
  }

  async computeFeatureEval(_feature_id: string): Promise<FeatureEvalSummary | null> {
    return null;
  }

  async recordSecurityFindings(
    _feature_id: string,
    _phase: PhaseId,
    findings: ReviewFinding[],
    _tool: string
  ): Promise<number> {
    return findings.length;
  }

  async declarePropagationTarget(
    learning_id: string,
    target_type: PersistedTargetType,
    target_path: string | null,
    relevance: number
  ): Promise<void> {
    this.propagation_targets.push({ learning_id, target_type, target_path, relevance });
  }

  async listRelatedLearnings(feature_id: string, limit = 5): Promise<RelatedLearningRecord[]> {
    // Get all propagation targets for this feature's learnings
    const feature_learnings = this.learnings.get(feature_id) ?? [];
    const feature_learning_ids = new Set(feature_learnings.map((l) => l.id));
    const feature_targets = this.propagation_targets.filter((t) => feature_learning_ids.has(t.learning_id));

    // Collect all learnings across all features
    const all_learnings: LearningRecord[] = [];
    for (const [fid, learnings] of this.learnings.entries()) {
      if (fid !== feature_id) {
        all_learnings.push(...learnings);
      }
    }

    if (feature_targets.length > 0) {
      // Primary path: shared propagation targets
      const target_keys = new Set(
        feature_targets.map((t) => `${t.target_type}:${t.target_path ?? ''}`)
      );

      const candidates: RelatedLearningRecord[] = [];
      for (const learning of all_learnings) {
        const learning_targets = this.propagation_targets.filter((t) => t.learning_id === learning.id);
        const shared = learning_targets
          .map((t) => `${t.target_type}:${t.target_path ?? ''}`)
          .filter((key) => target_keys.has(key));

        if (shared.length > 0) {
          candidates.push({
            id: learning.id,
            title: learning.title,
            category: learning.category,
            content: learning.content,
            confidence_score: 0.8,
            source_feature_id: learning.feature_id,
            shared_domains: [...new Set(shared)],
            shared_domain_count: new Set(shared).size,
          });
        }
      }

      return candidates
        .sort((a, b) => b.shared_domain_count - a.shared_domain_count || b.confidence_score - a.confidence_score)
        .slice(0, limit);
    }

    // Fallback: tag intersection (>= 2 shared tags)
    const feature_tags = new Set(feature_learnings.flatMap((l) => l.tags));
    if (feature_tags.size === 0) {
      return [];
    }

    const candidates: RelatedLearningRecord[] = [];
    for (const learning of all_learnings) {
      const shared_tags = learning.tags.filter((t) => feature_tags.has(t));
      if (shared_tags.length >= 2) {
        candidates.push({
          id: learning.id,
          title: learning.title,
          category: learning.category,
          content: learning.content,
          confidence_score: 0.8,
          source_feature_id: learning.feature_id,
          shared_domains: shared_tags,
          shared_domain_count: shared_tags.length,
        });
      }
    }

    return candidates
      .sort((a, b) => b.shared_domain_count - a.shared_domain_count)
      .slice(0, limit);
  }

  async listAllLearnings(filter?: ListAllLearningsFilter): Promise<LearningRecord[]> {
    let all: LearningRecord[] = [];

    if (filter?.feature_id != null) {
      all = [...(this.learnings.get(filter.feature_id) ?? [])];
    } else {
      for (const learnings of this.learnings.values()) {
        all.push(...learnings);
      }
    }

    if (filter?.category != null) {
      all = all.filter((l) => l.category === filter.category);
    }

    if (filter?.min_confidence != null) {
      const in_memory_confidence = 0.5;
      all = all.filter(() => in_memory_confidence >= filter.min_confidence!);
    }

    return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async replaceSkillProposalCandidates(candidates: SkillProposalCandidate[]): Promise<void> {
    this.skill_proposals.clear();
    for (const candidate of candidates) {
      this.skill_proposals.set(candidate.topic_key, candidate);
    }
  }

  async listSkillProposalCandidates(filter?: ListSkillProposalCandidatesFilter): Promise<SkillProposalCandidate[]> {
    let proposals = Array.from(this.skill_proposals.values());

    if (filter?.statuses != null && filter.statuses.length > 0) {
      const allowed = new Set(filter.statuses);
      proposals = proposals.filter((proposal) => allowed.has(proposal.status));
    }

    proposals.sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === 'DRAFT_READY' ? -1 : 1;
      }

      if (left.feature_count !== right.feature_count) {
        return right.feature_count - left.feature_count;
      }

      if (left.evidence_count !== right.evidence_count) {
        return right.evidence_count - left.evidence_count;
      }

      const recency = right.latest_learning_at.localeCompare(left.latest_learning_at);
      if (recency !== 0) {
        return recency;
      }

      return left.topic_key.localeCompare(right.topic_key);
    });

    return filter?.limit == null ? proposals : proposals.slice(0, filter.limit);
  }

  async upsertSkillProposalDraft(
    proposal: Omit<SkillProposalRecord, 'created_at' | 'updated_at' | 'approved_by' | 'approved_at' | 'published_by' | 'published_at'>,
  ): Promise<SkillProposalRecord> {
    const existing = this.skill_proposal_records.get(proposal.topic_key);
    const now = new Date().toISOString();

    const next: SkillProposalRecord = {
      ...proposal,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      approved_by: null,
      approved_at: null,
      published_by: null,
      published_at: null,
    };

    this.skill_proposal_records.set(proposal.topic_key, next);
    return next;
  }

  async listSkillProposals(filter?: ListSkillProposalsFilter): Promise<SkillProposalRecord[]> {
    let proposals = Array.from(this.skill_proposal_records.values());

    if (filter?.statuses != null && filter.statuses.length > 0) {
      const allowed = new Set(filter.statuses);
      proposals = proposals.filter((proposal) => allowed.has(proposal.status));
    }

    proposals.sort((left, right) => right.updated_at.localeCompare(left.updated_at) || left.topic_key.localeCompare(right.topic_key));
    return filter?.limit == null ? proposals : proposals.slice(0, filter.limit);
  }

  async recordSkillProposalDecision(
    topic_key: string,
    status: 'APPROVED' | 'REJECTED',
    actor: string,
    notes?: string,
  ): Promise<SkillProposalRecord> {
    const existing = this.skill_proposal_records.get(topic_key);
    if (existing == null) {
      throw new Error(`Skill proposal not found: ${topic_key}`);
    }

    const now = new Date().toISOString();
    const next: SkillProposalRecord = {
      ...existing,
      status,
      decision_notes: notes ?? null,
      updated_at: now,
      approved_by: status === 'APPROVED' ? actor : null,
      approved_at: status === 'APPROVED' ? now : null,
      published_by: status === 'REJECTED' ? null : existing.published_by,
      published_at: status === 'REJECTED' ? null : existing.published_at,
      published_path: status === 'REJECTED' ? null : existing.published_path,
    };

    this.skill_proposal_records.set(topic_key, next);
    return next;
  }

  async markSkillProposalPublished(topic_key: string, published_by: string, published_path: string): Promise<SkillProposalRecord> {
    const existing = this.skill_proposal_records.get(topic_key);
    if (existing == null) {
      throw new Error(`Skill proposal not found: ${topic_key}`);
    }

    const now = new Date().toISOString();
    const next: SkillProposalRecord = {
      ...existing,
      status: 'PUBLISHED',
      published_by,
      published_at: now,
      published_path,
      updated_at: now,
    };

    this.skill_proposal_records.set(topic_key, next);
    return next;
  }

  private touchFeature(feature_id: string): void {
    const feature = this.features.get(feature_id);
    if (feature == null) {
      return;
    }

    this.features.set(feature_id, {
      ...feature,
      updated_at: new Date().toISOString(),
    });
  }

  private findClaim(claim_id: string): AgentClaimRecord | null {
    for (const claims of this.claims.values()) {
      const match = claims.find((claim) => claim.id === claim_id);
      if (match != null) {
        return match;
      }
    }

    return null;
  }

  private getLatestPolicyVerdict(claim_id: string): PolicyVerdictRecord | null {
    const verdicts = this.policy_verdicts.get(claim_id) ?? [];
    return verdicts.at(-1) ?? null;
  }

  private getLatestWatcherReview(claim_id: string): WatcherReviewRecord | null {
    const reviews = this.watcher_reviews.get(claim_id) ?? [];
    return reviews.at(-1) ?? null;
  }

  private recordPolicyVerdictInternal(
    claim_id: string,
    verdict: VerificationStatus,
    rule_name: string,
    reason: string | null,
    evidence_checked: Record<string, unknown>
  ): PolicyVerdictRecord {
    const record: PolicyVerdictRecord = {
      id: randomUUID(),
      claim_id,
      verdict,
      rule_name,
      reason,
      evidence_checked,
      created_at: new Date().toISOString(),
    };

    const existing = this.policy_verdicts.get(claim_id) ?? [];
    this.policy_verdicts.set(claim_id, [...existing, record]);

    return record;
  }
}
