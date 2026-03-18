/**
 * In-Memory Workflow State Adapter
 * Version: 0.1.0
 */

import { getNextPhaseId } from '../../domain/phases.js';
import type {
  AgentInvocationRecord,
  ClaimVerificationSummary,
  FeatureEvalSummary,
  FeatureRecord,
  LearningRecord,
  PersistedTargetType,
  PhaseArtifact,
  PhaseId,
  PhaseResultRecord,
  RelatedLearningRecord,
  ReviewCheckRecord,
  ReviewFinding,
} from '../../types.js';
import type { ListAllLearningsFilter, WorkflowStateAdapter } from './types.js';

export class InMemoryWorkflowStateAdapter implements WorkflowStateAdapter {
  private readonly features = new Map<string, FeatureRecord>();
  private readonly artifacts = new Map<string, PhaseArtifact[]>();
  private readonly results = new Map<string, PhaseResultRecord[]>();
  private readonly review_checks = new Map<string, ReviewCheckRecord[]>();
  private readonly learnings = new Map<string, LearningRecord[]>();
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
    this.artifacts.set(artifact.feature_id, [...existing, artifact]);
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
    return [];
  }

  async listClaimVerificationStatus(_feature_id: string): Promise<ClaimVerificationSummary[]> {
    return [];
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
}
