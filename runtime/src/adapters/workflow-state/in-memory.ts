/**
 * In-Memory Workflow State Adapter
 * Version: 0.1.0
 */

import { randomUUID } from 'node:crypto';

import { getNextPhaseId } from '../../domain/phases.js';
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
  PhaseId,
  PhaseResultRecord,
  RelatedLearningRecord,
  ReviewCheckRecord,
  ReviewFinding,
  VerificationStatus,
  WatcherQueueClaim,
  WatcherReviewRecord,
} from '../../types.js';
import type { ListAllLearningsFilter, WorkflowStateAdapter } from './types.js';

export class InMemoryWorkflowStateAdapter implements WorkflowStateAdapter {
  private readonly features = new Map<string, FeatureRecord>();
  private readonly artifacts = new Map<string, PhaseArtifact[]>();
  private readonly results = new Map<string, PhaseResultRecord[]>();
  private readonly review_checks = new Map<string, ReviewCheckRecord[]>();
  private readonly learnings = new Map<string, LearningRecord[]>();
  private readonly commits = new Map<string, FeatureCommitRecord[]>();
  private readonly claims = new Map<string, AgentClaimRecord[]>();
  private readonly policy_verdicts = new Map<string, PolicyVerdictRecord[]>();
  private readonly watcher_reviews = new Map<string, WatcherReviewRecord[]>();
  private readonly invocations = new Map<string, AgentInvocationRecord>();
  private readonly propagation_targets: Array<{ learning_id: string; target_type: PersistedTargetType; target_path: string | null; relevance: number }> = [];
  private invocation_counter = 0;

  async startFeature(
    feature: Omit<FeatureRecord, 'created_at' | 'updated_at' | 'status' | 'current_phase'>
  ): Promise<FeatureRecord> {
    const now = new Date().toISOString();
    const record: FeatureRecord = {
      ...feature,
      status: 'PLANNED',
      current_phase: '0',
      created_at: now,
      updated_at: now,
    };

    this.features.set(record.id, record);

    return record;
  }

  async getFeature(feature_id: string): Promise<FeatureRecord | null> {
    return this.features.get(feature_id) ?? null;
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

  async listOpenBlockers(_feature_id: string): Promise<string[]> {
    return [];
  }

  async listOpenGates(_feature_id: string): Promise<string[]> {
    return [];
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
    if (record == null) {
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
    return { feature_id, pr_url, pr_number };
  }

  async recordMerge(
    feature_id: string,
    merged_by: string
  ): Promise<{ feature_id: string; merged_at: string; merged_by: string; pr_url?: string; pr_number?: number }> {
    return {
      feature_id,
      merged_at: new Date().toISOString(),
      merged_by,
    };
  }

  async recordQualityGate(
    _feature_id: string,
    _gate_name: string,
    _status: 'APPROVED' | 'REJECTED',
    _approver: string,
    _notes?: string
  ): Promise<number> {
    return 0;
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

    return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
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
