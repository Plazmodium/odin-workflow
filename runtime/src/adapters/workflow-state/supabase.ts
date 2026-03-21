/**
 * Supabase Workflow State Adapter
 * Version: 0.1.0
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { RuntimeConfig } from '../../config.js';
import type {
  AgentInvocationRecord,
  AgentClaimRecord,
  ClaimVerificationSummary,
  ClaimType,
  FeatureCommitRecord,
  FeatureEvalSummary,
  FeatureRecord,
  LearningRecord,
  PolicyCheckResult,
  PersistedTargetType,
  PhaseArtifact,
  PhaseId,
  PhaseResultRecord,
  RiskLevel,
  RelatedLearningRecord,
  ReviewCheckRecord,
  ReviewFinding,
  VerificationStatus,
  WatcherQueueClaim,
  WatcherReviewRecord,
} from '../../types.js';
import type { ListAllLearningsFilter, WorkflowStateAdapter } from './types.js';

type JsonRecord = { [key: string]: unknown };

function toFeatureRecord(row: JsonRecord): FeatureRecord {
  return {
    id: String(row.feature_id ?? row.id),
    name: String(row.feature_name ?? row.name),
    status: String(row.status) as FeatureRecord['status'],
    current_phase: String(row.current_phase) as FeatureRecord['current_phase'],
    complexity_level: Number(row.complexity_level) as FeatureRecord['complexity_level'],
    severity: String(row.severity) as FeatureRecord['severity'],
    requirements_path: row.requirements_path == null ? undefined : String(row.requirements_path),
    dev_initials: row.dev_initials == null ? undefined : String(row.dev_initials),
    branch_name: row.branch_name == null ? undefined : String(row.branch_name),
    base_branch: row.base_branch == null ? undefined : String(row.base_branch),
    author: row.author == null ? undefined : String(row.author),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function requireSupabaseConfig(config: RuntimeConfig): { url: string; secret_key: string } {
  const url = config.supabase?.url;
  const secret_key = config.supabase?.secret_key;

  if (!url || !secret_key) {
    throw new Error(
      'Supabase runtime mode requires SUPABASE_URL and SUPABASE_SECRET_KEY via .odin/config.yaml interpolation or environment variables.'
    );
  }

  return { url, secret_key };
}

export function shouldTransitionPhaseResult(result: PhaseResultRecord): boolean {
  return result.outcome !== 'blocked' && result.next_phase != null && result.next_phase !== result.phase;
}

export class SupabaseWorkflowStateAdapter implements WorkflowStateAdapter {
  private readonly client: SupabaseClient;

  constructor(config: RuntimeConfig) {
    const { url, secret_key } = requireSupabaseConfig(config);
    this.client = createClient(url, secret_key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async startFeature(
    feature: Omit<FeatureRecord, 'created_at' | 'updated_at' | 'status' | 'current_phase'>
  ): Promise<FeatureRecord> {
    const { data, error } = await this.client.rpc('create_feature', {
      p_id: feature.id,
      p_name: feature.name,
      p_complexity_level: feature.complexity_level,
      p_severity: feature.severity,
      p_epic_id: null,
      p_requirements_path: feature.requirements_path ?? null,
      p_created_by: 'odin-runtime',
      p_dev_initials: feature.dev_initials ?? null,
      p_base_branch: feature.base_branch ?? 'main',
      p_author: feature.author ?? null,
    });

    if (error != null || data == null || data.length === 0) {
      throw new Error(`Failed to create feature in Supabase: ${error?.message ?? 'No result returned.'}`);
    }

    const created = data[0] as JsonRecord;
    return {
      id: String(created.feature_id),
      name: String(created.feature_name),
      status: String(created.status) as FeatureRecord['status'],
      current_phase: '0',
      complexity_level: Number(created.complexity) as FeatureRecord['complexity_level'],
      severity: String(created.severity_level) as FeatureRecord['severity'],
      requirements_path: feature.requirements_path,
      dev_initials: feature.dev_initials,
      branch_name: created.branch_name == null ? undefined : String(created.branch_name),
      base_branch: created.base_branch == null ? undefined : String(created.base_branch),
      author: created.author == null ? undefined : String(created.author),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async getFeature(feature_id: string): Promise<FeatureRecord | null> {
    const { data, error } = await this.client.rpc('get_feature_status', {
      p_feature_id: feature_id,
    });

    if (error != null) {
      throw new Error(`Failed to fetch feature status from Supabase: ${error.message}`);
    }

    if (data == null || data.length === 0) {
      return null;
    }

    return toFeatureRecord(data[0] as JsonRecord);
  }

  async recordPhaseArtifact(artifact: PhaseArtifact): Promise<PhaseArtifact> {
    const { data, error } = await this.client.rpc('record_phase_output', {
      p_feature_id: artifact.feature_id,
      p_phase: artifact.phase,
      p_output_type: artifact.output_type,
      p_content: artifact.content,
      p_created_by: artifact.created_by,
    });

    if (error != null || data == null) {
      throw new Error(`Failed to record phase artifact: ${error?.message ?? 'No result returned.'}`);
    }

    const row = data as JsonRecord;
    return {
      id: String(row.id),
      feature_id: String(row.feature_id),
      phase: String(row.phase) as PhaseArtifact['phase'],
      output_type: String(row.output_type),
      content: row.content,
      created_by: String(row.created_by),
      created_at: String(row.created_at),
    };
  }

  async listPhaseArtifacts(feature_id: string): Promise<PhaseArtifact[]> {
    const { data, error } = await this.client
      .from('phase_outputs')
      .select('*')
      .eq('feature_id', feature_id)
      .order('phase', { ascending: true })
      .order('created_at', { ascending: true });

    if (error != null) {
      throw new Error(`Failed to list phase artifacts from Supabase: ${error.message}`);
    }

    if (data == null) {
      return [];
    }

    return (data as JsonRecord[]).map((row) => ({
      id: String(row.id),
      feature_id: String(row.feature_id),
      phase: String(row.phase) as PhaseArtifact['phase'],
      output_type: String(row.output_type),
      content: row.content,
      created_by: String(row.created_by),
      created_at: String(row.created_at),
    }));
  }

  async recordPhaseResult(result: PhaseResultRecord): Promise<FeatureRecord | null> {
    if (shouldTransitionPhaseResult(result)) {
      const { error } = await this.client.rpc('transition_phase', {
        p_feature_id: result.feature_id,
        p_to_phase: result.next_phase,
        p_transitioned_by: result.created_by,
        p_notes: result.summary,
      });

      if (error != null) {
        throw new Error(`Failed to transition phase in Supabase: ${error.message}`);
      }
    }

    const status =
      result.outcome === 'blocked'
        ? 'BLOCKED'
        : result.next_phase === '10' || result.phase === '10'
          ? 'COMPLETED'
          : 'IN_PROGRESS';

    const { error } = await this.client
      .from('features')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', result.feature_id);

    if (error != null) {
      throw new Error(`Failed to update feature result state in Supabase: ${error.message}`);
    }

    return this.getFeature(result.feature_id);
  }

  async listOpenBlockers(feature_id: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('blockers')
      .select('title, severity, status')
      .eq('feature_id', feature_id)
      .in('status', ['OPEN', 'IN_PROGRESS'])
      .order('created_at', { ascending: false });

    if (error != null) {
      throw new Error(`Failed to list blockers from Supabase: ${error.message}`);
    }

    if (data == null) {
      return [];
    }

    return (data as JsonRecord[]).map((row) => `${row.title} (${row.severity}/${row.status})`);
  }

  async listOpenGates(feature_id: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('quality_gates')
      .select('gate_name, status, phase')
      .eq('feature_id', feature_id)
      .in('status', ['PENDING', 'REJECTED'])
      .order('phase', { ascending: true });

    if (error != null) {
      throw new Error(`Failed to list quality gates from Supabase: ${error.message}`);
    }

    if (data == null) {
      return [];
    }

    return (data as JsonRecord[]).map(
      (row) => `${row.gate_name} [phase ${row.phase}] (${row.status})`
    );
  }

  async listOpenFindings(feature_id: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('security_findings')
      .select('severity, message, file_path, resolved')
      .eq('feature_id', feature_id)
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (error != null) {
      throw new Error(`Failed to list security findings from Supabase: ${error.message}`);
    }

    if (data == null) {
      return [];
    }

    return (data as JsonRecord[]).map((row) => {
      const file_path = row.file_path == null ? 'unknown-file' : String(row.file_path);
      return `${row.severity}: ${row.message} (${file_path})`;
    });
  }

  async listPendingClaims(feature_id: string): Promise<string[]> {
    const { data: claims, error: claims_error } = await this.client
      .from('agent_claims')
      .select('id, claim_type, agent_name, created_at')
      .eq('feature_id', feature_id)
      .order('created_at', { ascending: true });

    if (claims_error != null) {
      throw new Error(`Failed to list agent claims from Supabase: ${claims_error.message}`);
    }

    if (claims == null || claims.length === 0) {
      return [];
    }

    const claim_ids = (claims as JsonRecord[]).map((claim) => String(claim.id));

    const { data: reviews, error: reviews_error } = await this.client
      .from('watcher_reviews')
      .select('claim_id, verdict, reviewed_at')
      .in('claim_id', claim_ids);
    const { data: verdict_rows, error: verdicts_error } = await this.client
      .from('policy_verdicts')
      .select('claim_id, verdict, created_at')
      .in('claim_id', claim_ids);

    if (verdicts_error != null) {
      throw new Error(`Failed to list policy verdicts from Supabase: ${verdicts_error.message}`);
    }

    if (reviews_error != null) {
      throw new Error(`Failed to list watcher reviews from Supabase: ${reviews_error.message}`);
    }

    const latest_verdict = new Map<string, JsonRecord>();
    for (const verdict of (verdict_rows ?? []) as JsonRecord[]) {
      const claim_id = String(verdict.claim_id);
      const existing = latest_verdict.get(claim_id);
      if (
        existing == null ||
        new Date(String(verdict.created_at)).getTime() > new Date(String(existing.created_at)).getTime()
      ) {
        latest_verdict.set(claim_id, verdict);
      }
    }

    const latest_review = new Map<string, JsonRecord>();
    for (const review of (reviews ?? []) as JsonRecord[]) {
      const claim_id = String(review.claim_id);
      const existing = latest_review.get(claim_id);
      if (
        existing == null ||
        new Date(String(review.reviewed_at)).getTime() > new Date(String(existing.reviewed_at)).getTime()
      ) {
        latest_review.set(claim_id, review);
      }
    }

    return (claims as JsonRecord[])
      .map((claim) => {
        const claim_id = String(claim.id);
        const review = latest_review.get(claim_id);
        const verdict = latest_verdict.get(claim_id);

        if (review != null && String(review.verdict) === 'PASS') {
          return null;
        }

        if (review != null && String(review.verdict) === 'FAIL') {
          return `${claim.claim_type} by ${claim.agent_name} (watcher FAIL)`;
        }

        if (verdict == null) {
          return `${claim.claim_type} by ${claim.agent_name} (pending policy)`;
        }

        if (String(verdict.verdict) === 'PASS') {
          return null;
        }

        return `${claim.claim_type} by ${claim.agent_name} (${verdict.verdict})`;
      })
      .filter((value): value is string => value != null);
  }

  async listClaimVerificationStatus(feature_id: string): Promise<ClaimVerificationSummary[]> {
    const { data, error } = await this.client.rpc('get_feature_claims', {
      p_feature_id: feature_id,
    });

    if (error != null) {
      throw new Error(`Failed to list claim verification state from Supabase: ${error.message}`);
    }

    if (data == null) {
      return [];
    }

    return (data as JsonRecord[]).map((row) => ({
      claim_id: String(row.claim_id),
      claim_type: String(row.claim_type) as ClaimType,
      agent_name: String(row.agent_name),
      risk_level: String(row.risk_level) as RiskLevel,
      policy_verdict: row.policy_verdict == null ? null : (String(row.policy_verdict) as VerificationStatus),
      watcher_verdict: row.watcher_verdict == null ? null : (String(row.watcher_verdict) as VerificationStatus),
      final_status: String(row.final_status) as VerificationStatus,
    }));
  }

  async submitClaim(claim: Omit<AgentClaimRecord, 'id' | 'created_at'>): Promise<AgentClaimRecord> {
    const { data, error } = await this.client.rpc('submit_claim', {
      p_feature_id: claim.feature_id,
      p_phase: claim.phase,
      p_agent_name: claim.agent_name,
      p_claim_type: claim.claim_type,
      p_description: claim.claim_description,
      p_evidence_refs: claim.evidence_refs,
      p_risk_level: claim.risk_level,
      p_invocation_id: claim.invocation_id,
    });

    if (error != null || data == null || data.length === 0) {
      throw new Error(`Failed to submit claim: ${error?.message ?? 'No result returned.'}`);
    }

    const row = data[0] as JsonRecord;
    return {
      id: String(row.claim_id),
      feature_id: String(row.feature_id),
      phase: String(row.phase) as PhaseId,
      agent_name: claim.agent_name,
      invocation_id: claim.invocation_id,
      claim_type: String(row.claim_type) as ClaimType,
      claim_description: claim.claim_description,
      evidence_refs: claim.evidence_refs,
      risk_level: String(row.risk_level) as RiskLevel,
      created_at: String(row.created_at),
    };
  }

  async runPolicyChecks(feature_id: string): Promise<PolicyCheckResult[]> {
    const { data, error } = await this.client.rpc('run_policy_checks', {
      p_feature_id: feature_id,
    });

    if (error != null) {
      throw new Error(`Failed to run policy checks: ${error.message}`);
    }

    if (data == null) {
      return [];
    }

    return (data as JsonRecord[]).map((row) => ({
      claim_id: String(row.claim_id),
      claim_type: String(row.claim_type) as ClaimType,
      verdict: String(row.verdict) as VerificationStatus,
      needs_watcher: Boolean(row.needs_watcher),
    }));
  }

  async listClaimsNeedingReview(feature_id?: string): Promise<WatcherQueueClaim[]> {
    const { data, error } = await this.client.rpc('get_claims_needing_review', {
      p_feature_id: feature_id ?? null,
    });

    if (error != null) {
      throw new Error(`Failed to list claims needing watcher review: ${error.message}`);
    }

    if (data == null) {
      return [];
    }

    return (data as JsonRecord[]).map((row) => ({
      claim_id: String(row.claim_id),
      feature_id: String(row.feature_id),
      phase: String(row.phase) as PhaseId,
      agent_name: String(row.agent_name),
      claim_type: String(row.claim_type) as ClaimType,
      claim_description: String(row.claim_description),
      evidence_refs:
        row.evidence_refs != null && typeof row.evidence_refs === 'object' && !Array.isArray(row.evidence_refs)
          ? (row.evidence_refs as Record<string, unknown>)
          : {},
      risk_level: String(row.risk_level) as RiskLevel,
      policy_verdict: row.policy_verdict == null ? null : (String(row.policy_verdict) as VerificationStatus),
      policy_reason: row.policy_reason == null ? null : String(row.policy_reason),
      created_at: String(row.created_at),
    }));
  }

  async recordWatcherReview(review: Omit<WatcherReviewRecord, 'id' | 'reviewed_at'>): Promise<WatcherReviewRecord> {
    const { data, error } = await this.client.rpc('record_watcher_review', {
      p_claim_id: review.claim_id,
      p_verdict: review.verdict,
      p_reasoning: review.reasoning,
      p_watcher_agent: review.watcher_agent,
      p_confidence: review.confidence,
    });

    if (error != null || data == null || data.length === 0) {
      throw new Error(`Failed to record watcher review: ${error?.message ?? 'No result returned.'}`);
    }

    const row = data[0] as JsonRecord;
    return {
      id: String(row.review_id),
      claim_id: String(row.claim_id),
      verdict: String(row.verdict) as WatcherReviewRecord['verdict'],
      confidence: Number(row.confidence),
      reasoning: review.reasoning,
      watcher_agent: review.watcher_agent,
      reviewed_at: new Date().toISOString(),
    };
  }

  async getLatestFeatureEval(feature_id: string): Promise<FeatureEvalSummary | null> {
    const { data, error } = await this.client
      .from('feature_evals')
      .select('id, feature_id, computed_at, efficiency_score, quality_score, overall_score, health_status')
      .eq('feature_id', feature_id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error != null) {
      throw new Error(`Failed to fetch feature eval from Supabase: ${error.message}`);
    }

    if (data == null) {
      return null;
    }

    const row = data as JsonRecord;
    return {
      id: String(row.id),
      feature_id: String(row.feature_id),
      computed_at: String(row.computed_at),
      efficiency_score: row.efficiency_score == null ? null : Number(row.efficiency_score),
      quality_score: row.quality_score == null ? null : Number(row.quality_score),
      overall_score: row.overall_score == null ? null : Number(row.overall_score),
      health_status: String(row.health_status),
    };
  }

  async recordReviewCheck(check: ReviewCheckRecord): Promise<ReviewCheckRecord> {
    const artifact = await this.recordPhaseArtifact({
      id: check.id,
      feature_id: check.feature_id,
      phase: check.phase,
      output_type: 'security_review_runtime',
      content: {
        tool: check.tool,
        status: check.status,
        summary: check.summary,
        changed_files: check.changed_files,
        initiated_by: check.initiated_by,
      },
      created_by: check.initiated_by,
      created_at: check.created_at,
    });

    return {
      ...check,
      id: artifact.id,
      created_at: artifact.created_at,
    };
  }

  async listReviewChecks(feature_id: string): Promise<ReviewCheckRecord[]> {
    const artifacts = await this.listPhaseArtifacts(feature_id);
    return artifacts
      .filter((artifact) => artifact.output_type === 'security_review_runtime')
      .map((artifact) => {
        const content = artifact.content as JsonRecord;
        return {
          id: artifact.id,
          feature_id: artifact.feature_id,
          phase: artifact.phase,
          tool: String(content.tool ?? 'semgrep') as ReviewCheckRecord['tool'],
          status: String(content.status ?? 'queued') as ReviewCheckRecord['status'],
          summary: String(content.summary ?? ''),
          changed_files: Array.isArray(content.changed_files)
            ? content.changed_files.map((value) => String(value))
            : [],
          initiated_by: String(content.initiated_by ?? artifact.created_by),
          created_at: artifact.created_at,
        };
      });
  }

  async captureLearning(learning: LearningRecord): Promise<LearningRecord> {
    const { data, error } = await this.client
      .from('learnings')
      .insert({
        feature_id: learning.feature_id,
        category: learning.category,
        title: learning.title,
        content: learning.content,
        confidence_score: 0.5,
        validation_count: 0,
        validated_by: [],
        importance: 'MEDIUM',
        tags: learning.tags.length > 0 ? learning.tags : ['odin-runtime'],
        phase: learning.phase,
        agent: learning.created_by,
        created_by: learning.created_by,
      })
      .select('*')
      .single();

    if (error != null || data == null) {
      throw new Error(`Failed to capture learning in Supabase: ${error?.message ?? 'No result returned.'}`);
    }

    return {
      id: String(data.id),
      feature_id: String(data.feature_id),
      phase: String(data.phase) as LearningRecord['phase'],
      title: String(data.title),
      content: String(data.content),
      category: String(data.category) as LearningRecord['category'],
      tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
      created_by: String(data.created_by),
      created_at: String(data.created_at),
    };
  }

  async listLearnings(feature_id: string): Promise<LearningRecord[]> {
    const { data, error } = await this.client
      .from('learnings')
      .select('*')
      .eq('feature_id', feature_id)
      .order('created_at', { ascending: false });

    if (error != null) {
      throw new Error(`Failed to list learnings from Supabase: ${error.message}`);
    }

    if (data == null) {
      return [];
    }

    return (data as JsonRecord[]).map((row) => ({
      id: String(row.id),
      feature_id: String(row.feature_id),
      phase: String(row.phase) as LearningRecord['phase'],
      title: String(row.title),
      content: String(row.content),
      category: String(row.category) as LearningRecord['category'],
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      created_by: String(row.created_by),
      created_at: String(row.created_at),
    }));
  }

  async findOpenAgentInvocation(
    feature_id: string,
    phase: PhaseId,
    agent_name: string
  ): Promise<AgentInvocationRecord | null> {
    const { data, error } = await this.client
      .from('agent_invocations')
      .select('*')
      .eq('feature_id', feature_id)
      .eq('phase', phase)
      .eq('agent_name', agent_name)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error != null) {
      throw new Error(`Failed to find open agent invocation: ${error.message}`);
    }

    if (data == null) {
      return null;
    }

    const row = data as JsonRecord;
    return {
      id: String(row.id),
      feature_id: String(row.feature_id),
      phase: String(row.phase) as PhaseId,
      agent_name: String(row.agent_name),
      operation: row.operation == null ? null : String(row.operation),
      skills_used: Array.isArray(row.skills_used) ? row.skills_used.map((value) => String(value)) : [],
      started_at: String(row.started_at),
      ended_at: row.ended_at == null ? null : String(row.ended_at),
      duration_ms: row.duration_ms == null ? null : Number(row.duration_ms),
    };
  }

  async startAgentInvocation(
    feature_id: string,
    phase: PhaseId,
    agent_name: string,
    operation?: string,
    skills?: string[]
  ): Promise<AgentInvocationRecord> {
    const { data, error } = await this.client.rpc('start_agent_invocation', {
      p_feature_id: feature_id,
      p_phase: phase,
      p_agent_name: agent_name,
      p_operation: operation ?? null,
      p_skills: skills ?? null,
    });

    if (error != null || data == null) {
      throw new Error(`Failed to start agent invocation: ${error?.message ?? 'No result returned.'}`);
    }

    const row = (Array.isArray(data) ? data[0] : data) as JsonRecord;
    return {
      id: String(row.id),
      feature_id: String(row.feature_id),
      phase: String(row.phase) as PhaseId,
      agent_name: String(row.agent_name),
      operation: row.operation == null ? null : String(row.operation),
      skills_used: Array.isArray(row.skills_used) ? row.skills_used.map((v) => String(v)) : [],
      started_at: String(row.started_at),
      ended_at: row.ended_at == null ? null : String(row.ended_at),
      duration_ms: row.duration_ms == null ? null : Number(row.duration_ms),
    };
  }

  async completeAgentInvocation(invocation_id: string): Promise<AgentInvocationRecord> {
    const { data, error } = await this.client.rpc('end_agent_invocation', {
      p_invocation_id: invocation_id,
    });

    if (error != null || data == null) {
      throw new Error(`Failed to complete agent invocation: ${error?.message ?? 'No result returned.'}`);
    }

    const row = (Array.isArray(data) ? data[0] : data) as JsonRecord;
    return {
      id: String(row.id),
      feature_id: String(row.feature_id),
      phase: String(row.phase) as PhaseId,
      agent_name: String(row.agent_name),
      operation: row.operation == null ? null : String(row.operation),
      skills_used: Array.isArray(row.skills_used) ? row.skills_used.map((v) => String(v)) : [],
      started_at: String(row.started_at),
      ended_at: row.ended_at == null ? null : String(row.ended_at),
      duration_ms: row.duration_ms == null ? null : Number(row.duration_ms),
    };
  }

  async recordCommit(commit: Omit<FeatureCommitRecord, 'committed_at'>): Promise<FeatureCommitRecord> {
    const { data, error } = await this.client.rpc('record_commit', {
      p_feature_id: commit.feature_id,
      p_commit_hash: commit.commit_hash,
      p_phase: commit.phase,
      p_message: commit.message ?? null,
      p_files_changed: commit.files_changed ?? null,
      p_insertions: commit.insertions ?? null,
      p_deletions: commit.deletions ?? null,
      p_committed_by: commit.committed_by,
    });

    if (error != null || data == null || data.length === 0) {
      throw new Error(`Failed to record commit: ${error?.message ?? 'No result returned.'}`);
    }

    const row = data[0] as JsonRecord;
    return {
      feature_id: String(row.feature_id),
      commit_hash: String(row.commit_hash),
      phase: String(row.phase) as PhaseId,
      message: row.message == null ? undefined : String(row.message),
      files_changed: row.files_changed == null ? undefined : Number(row.files_changed),
      insertions: row.insertions == null ? undefined : Number(row.insertions),
      deletions: row.deletions == null ? undefined : Number(row.deletions),
      committed_at: String(row.committed_at ?? row.created_at ?? new Date().toISOString()),
      committed_by: row.committed_by == null ? commit.committed_by : String(row.committed_by),
    };
  }

  async recordPullRequest(
    feature_id: string,
    pr_url: string,
    pr_number: number
  ): Promise<{ feature_id: string; pr_url: string; pr_number: number }> {
    const { error } = await this.client.rpc('record_pr', {
      p_feature_id: feature_id,
      p_pr_url: pr_url,
      p_pr_number: pr_number,
    });

    if (error != null) {
      throw new Error(`Failed to record pull request: ${error.message}`);
    }

    return { feature_id, pr_url, pr_number };
  }

  async recordMerge(
    feature_id: string,
    merged_by: string
  ): Promise<{ feature_id: string; merged_at: string; merged_by: string; pr_url?: string; pr_number?: number }> {
    const { data, error } = await this.client.rpc('record_merge', {
      p_feature_id: feature_id,
      p_merged_by: merged_by,
    });

    if (error != null || data == null || data.length === 0) {
      throw new Error(`Failed to record merge: ${error?.message ?? 'No result returned.'}`);
    }

    const row = data[0] as JsonRecord;
    return {
      feature_id,
      merged_at: String(row.merged_at ?? new Date().toISOString()),
      merged_by,
      pr_url: row.pr_url == null ? undefined : String(row.pr_url),
      pr_number: row.pr_number == null ? undefined : Number(row.pr_number),
    };
  }

  async recordQualityGate(
    feature_id: string,
    gate_name: string,
    status: 'APPROVED' | 'REJECTED',
    approver: string,
    notes?: string
  ): Promise<number> {
    const { data, error } = await this.client.rpc('approve_gate', {
      p_feature_id: feature_id,
      p_gate_name: gate_name,
      p_status: status,
      p_approver: approver,
      p_approval_notes: notes ?? null,
    });

    if (error != null) {
      throw new Error(`Failed to record quality gate: ${error.message}`);
    }

    return Number(data);
  }

  async computeFeatureEval(feature_id: string): Promise<FeatureEvalSummary | null> {
    const { error } = await this.client.rpc('compute_feature_eval', {
      p_feature_id: feature_id,
    });

    if (error != null) {
      throw new Error(`Failed to compute feature eval: ${error.message}`);
    }

    return this.getLatestFeatureEval(feature_id);
  }

  async recordSecurityFindings(
    feature_id: string,
    phase: PhaseId,
    findings: ReviewFinding[],
    tool: string
  ): Promise<number> {
    if (findings.length === 0) {
      return 0;
    }

    const rows = findings.map((finding) => ({
      feature_id,
      phase,
      tool,
      rule_id: finding.rule_id,
      severity: finding.severity,
      file_path: finding.file_path,
      line_number: finding.line_number,
      message: finding.message,
      resolved: false,
    }));

    const { error } = await this.client.from('security_findings').insert(rows);

    if (error != null) {
      throw new Error(`Failed to record security findings: ${error.message}`);
    }

    return findings.length;
  }

  async declarePropagationTarget(
    learning_id: string,
    target_type: PersistedTargetType,
    target_path: string | null,
    relevance: number
  ): Promise<void> {
    const { error } = await this.client.rpc('declare_propagation_target', {
      p_learning_id: learning_id,
      p_target_type: target_type,
      p_target_path: target_path,
      p_relevance_score: relevance,
    });

    if (error != null) {
      throw new Error(`Failed to declare propagation target: ${error.message}`);
    }
  }

  async listAllLearnings(filter?: ListAllLearningsFilter): Promise<LearningRecord[]> {
    let query = this.client
      .from('learnings')
      .select('*')
      .eq('is_superseded', false)
      .order('created_at', { ascending: false });

    if (filter?.feature_id != null) {
      query = query.eq('feature_id', filter.feature_id);
    }

    if (filter?.category != null) {
      query = query.eq('category', filter.category);
    }

    if (filter?.min_confidence != null) {
      query = query.gte('confidence_score', filter.min_confidence);
    }

    const { data, error } = await query;

    if (error != null) {
      throw new Error(`Failed to list all learnings from Supabase: ${error.message}`);
    }

    if (data == null) {
      return [];
    }

    return (data as JsonRecord[]).map((row) => ({
      id: String(row.id),
      feature_id: String(row.feature_id),
      phase: String(row.phase) as LearningRecord['phase'],
      title: String(row.title),
      content: String(row.content),
      category: String(row.category) as LearningRecord['category'],
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      created_by: String(row.created_by),
      created_at: String(row.created_at),
    }));
  }

  async listRelatedLearnings(feature_id: string, limit = 5): Promise<RelatedLearningRecord[]> {
    const { data, error } = await this.client.rpc('get_related_learnings', {
      p_feature_id: feature_id,
      p_limit: limit,
    });

    if (error != null) {
      throw new Error(`Failed to list related learnings from Supabase: ${error.message}`);
    }

    if (data == null || !Array.isArray(data)) {
      return [];
    }

    return (data as JsonRecord[]).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      category: String(row.category),
      content: String(row.content),
      confidence_score: Number(row.confidence_score),
      source_feature_id: String(row.source_feature_id),
      shared_domains: Array.isArray(row.shared_domains) ? (row.shared_domains as string[]) : [],
      shared_domain_count: Number(row.shared_domain_count),
    }));
  }
}
