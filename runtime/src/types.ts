/**
 * Odin Runtime Domain Types
 * Version: 0.1.0
 */

export const PHASE_IDS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

export const FEATURE_STATUSES = ['IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'] as const;

export const PHASE_OUTCOMES = ['completed', 'blocked', 'needs_rework'] as const;

export const REVIEW_TOOLS = ['semgrep'] as const;

export const REVIEW_CHECK_STATUSES = ['queued', 'passed', 'failed'] as const;

export const CLAIM_TYPES = [
  'CODE_ADDED',
  'CODE_MODIFIED',
  'CODE_DELETED',
  'TEST_ADDED',
  'TEST_PASSED',
  'TEST_FAILED',
  'BUILD_SUCCEEDED',
  'BUILD_FAILED',
  'SECURITY_CHECKED',
  'SECURITY_FINDING_RESOLVED',
  'INTEGRATION_VERIFIED',
  'ARCHIVE_CREATED',
  'PR_CREATED',
] as const;

export const VERIFICATION_STATUSES = ['PENDING', 'PASS', 'FAIL', 'NEEDS_REVIEW'] as const;

export const WATCHER_REVIEW_VERDICTS = ['PASS', 'FAIL'] as const;

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const QUALITY_GATE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export const LEARNING_CATEGORIES = [
  'DECISION',
  'PATTERN',
  'GOTCHA',
  'CONVENTION',
  'ARCHITECTURE',
  'RATIONALE',
  'OPTIMIZATION',
  'INTEGRATION',
] as const;

export const ARTIFACT_OUTPUT_TYPES = [
  'prd',
  'requirements',
  'spec',
  'tasks',
  'review',
  'documentation',
  'release_notes',
  'design_verification',
  'eval_plan',
  'eval_run',
] as const;

export const DEVELOPMENT_EVAL_MODES = ['l1_minimal', 'plan_required'] as const;
export const SKILL_PROPOSAL_STATUSES = ['CANDIDATE', 'DRAFT_READY'] as const;
export const SKILL_PROPOSAL_REVIEW_STATUSES = ['DRAFT', 'APPROVED', 'REJECTED', 'PUBLISHED'] as const;
export const AUTOMATION_MODES = ['guarded', 'auto_pr', 'auto_merge'] as const;
export const AUTOMATION_MERGE_STRATEGIES = ['squash', 'merge', 'rebase'] as const;
export const AUTONOMY_BOARD_STATUSES = [
  'ready_for_phase',
  'running',
  'blocked',
  'waiting_on_review',
  'waiting_on_watchers',
  'waiting_on_human_pr',
  'waiting_on_human_merge',
  'completed',
] as const;
export const AUTONOMY_SELECTION_REASONS = ['ready_for_phase', 'merged_and_ready_to_close_release'] as const;
export const SUPERVISOR_EVENT_TYPES = ['tick_started', 'tick_selected', 'tick_noop', 'tick_failed', 'tick_completed'] as const;

export type PhaseId = (typeof PHASE_IDS)[number];
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];
export type PhaseOutcome = (typeof PHASE_OUTCOMES)[number];
export type ReviewTool = (typeof REVIEW_TOOLS)[number];
export type ReviewCheckStatus = (typeof REVIEW_CHECK_STATUSES)[number];
export type ClaimType = (typeof CLAIM_TYPES)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type WatcherReviewVerdict = (typeof WATCHER_REVIEW_VERDICTS)[number];
export type RiskLevel = (typeof RISK_LEVELS)[number];
export type QualityGateStatus = (typeof QUALITY_GATE_STATUSES)[number];
export type LearningCategory = (typeof LEARNING_CATEGORIES)[number];
export type ArtifactOutputType = (typeof ARTIFACT_OUTPUT_TYPES)[number];
export type DevelopmentEvalMode = (typeof DEVELOPMENT_EVAL_MODES)[number];
export type SkillProposalStatus = (typeof SKILL_PROPOSAL_STATUSES)[number];
export type SkillProposalReviewStatus = (typeof SKILL_PROPOSAL_REVIEW_STATUSES)[number];
export type AutomationMode = (typeof AUTOMATION_MODES)[number];
export type AutomationMergeStrategy = (typeof AUTOMATION_MERGE_STRATEGIES)[number];
export type AutonomyBoardStatus = (typeof AUTONOMY_BOARD_STATUSES)[number];
export type AutonomySelectionReason = (typeof AUTONOMY_SELECTION_REASONS)[number];
export type SupervisorEventType = (typeof SUPERVISOR_EVENT_TYPES)[number];

export type PersistedTargetType = 'skill' | 'agent_definition' | 'agents_md';

export interface AutomationPolicyConfig {
  mode: AutomationMode;
  allowed_base_branches: string[];
  require_green_checks: boolean;
  require_clean_policy_checks: boolean;
  require_no_open_blockers: boolean;
  require_watched_claims_verified: boolean;
  paused: boolean;
  kill_switch: boolean;
  merge_strategy: AutomationMergeStrategy;
}

export interface AutomationCapabilities {
  can_open_pr: boolean;
  can_update_pr: boolean;
  can_merge: boolean;
  can_continue_without_human_prompt: boolean;
}

export interface AutomationClaimVerificationSummary {
  total: number;
  passed: number;
  failed: number;
  needs_review: number;
  pending: number;
}

export interface AutomationDecision {
  configured_mode: AutomationMode;
  effective_mode: Exclude<AutomationMode, 'auto_merge'>;
  paused: boolean;
  kill_switch_active: boolean;
  base_branch: string | null;
  allowed_base_branch: boolean;
  capabilities: AutomationCapabilities;
  blocking_reasons: string[];
  next_human_boundary: 'pr' | 'merge';
  preconditions: {
    open_blockers: number;
    open_gates: number;
    open_findings: number;
    pending_claims: number;
    claims_needing_review: number;
    claim_verification: AutomationClaimVerificationSummary;
  };
}

export interface AutonomyFeatureState {
  status: AutonomyBoardStatus;
  detail: string;
  can_pick_now: boolean;
  selection_reason: AutonomySelectionReason | null;
}

export interface ReleaseStatusSummary {
  pr_url: string | null;
  pr_number: number | null;
  merged_at: string | null;
  completed_at: string | null;
}

export interface KnowledgeDomain {
  id: string;
  name: string;
  target_type: PersistedTargetType;
  target_path: string | null;
  strong_keywords: string[];
  weak_keywords: string[];
}

export interface DomainMatch {
  domain: KnowledgeDomain;
  relevance: number;
  strong_matches: string[];
  weak_matches: string[];
  persisted: boolean;
}

export interface ResolvedSkill {
  name: string;
  category: string;
  source: 'built_in' | 'project_local' | 'override';
  content: string;
}

export interface ArchiveFile {
  name: string;
  content: string;
}

export interface ArchiveUploadResult {
  success: boolean;
  storage_path: string;
  files_uploaded: string[];
  total_size_bytes: number;
  errors?: string[];
}

export interface FeatureArchiveRecord {
  id: string;
  feature_id: string;
  storage_path: string;
  summary: string;
  files_archived: string[];
  total_size_bytes: number;
  spec_snapshot: unknown;
  release_version?: string;
  release_notes?: string;
  archived_at: string;
  archived_by: string;
}

export interface FeatureEvalSummary {
  id: string;
  feature_id: string;
  computed_at: string;
  efficiency_score: number | null;
  quality_score: number | null;
  overall_score: number | null;
  health_status: string;
}

export interface QualityGateRecord {
  id: number;
  feature_id: string;
  gate_name: string;
  phase: PhaseId;
  status: QualityGateStatus;
  approver: string;
  approved_at: string;
  approval_notes: string | null;
}

export interface ClaimVerificationSummary {
  claim_id: string;
  claim_type: ClaimType;
  agent_name: string;
  risk_level: RiskLevel;
  policy_verdict: VerificationStatus | null;
  watcher_verdict: VerificationStatus | null;
  final_status: VerificationStatus;
}

export interface AgentClaimRecord {
  id: string;
  feature_id: string;
  phase: PhaseId;
  agent_name: string;
  invocation_id: string | null;
  claim_type: ClaimType;
  claim_description: string;
  evidence_refs: Record<string, unknown>;
  risk_level: RiskLevel;
  created_at: string;
}

export interface PolicyVerdictRecord {
  id: string;
  claim_id: string;
  verdict: VerificationStatus;
  rule_name: string;
  reason: string | null;
  evidence_checked: Record<string, unknown>;
  created_at: string;
}

export interface WatcherReviewRecord {
  id: string;
  claim_id: string;
  verdict: WatcherReviewVerdict;
  confidence: number;
  reasoning: string;
  watcher_agent: string;
  reviewed_at: string;
}

export interface PolicyCheckResult {
  claim_id: string;
  claim_type: ClaimType;
  verdict: VerificationStatus;
  needs_watcher: boolean;
}

export interface WatcherQueueClaim {
  claim_id: string;
  feature_id: string;
  phase: PhaseId;
  agent_name: string;
  claim_type: ClaimType;
  claim_description: string;
  evidence_refs: Record<string, unknown>;
  risk_level: RiskLevel;
  policy_verdict: VerificationStatus | null;
  policy_reason: string | null;
  created_at: string;
}

export interface PhaseContract {
  id: PhaseId;
  name: string;
  purpose: string;
  definition_of_done: string[];
  required_artifacts: ArtifactOutputType[];
  allowed_next_phases: PhaseId[];
}

export interface FeatureRecord {
  id: string;
  name: string;
  status: FeatureStatus;
  current_phase: PhaseId;
  complexity_level: 1 | 2 | 3;
  severity: 'ROUTINE' | 'EXPEDITED' | 'CRITICAL';
  requirements_path?: string;
  dev_initials?: string;
  branch_name?: string;
  base_branch?: string;
  pr_url?: string;
  pr_number?: number;
  merged_at?: string;
  completed_at?: string;
  author?: string;
  created_at: string;
  updated_at: string;
}

export interface PhaseArtifact {
  id: string;
  feature_id: string;
  phase: PhaseId;
  output_type: ArtifactOutputType | string;
  content: unknown;
  created_by: string;
  created_at: string;
}

export interface PhaseResultRecord {
  id: string;
  feature_id: string;
  phase: PhaseId;
  outcome: PhaseOutcome;
  summary: string;
  next_phase: PhaseId | null;
  blockers: string[];
  created_by: string;
  created_at: string;
}

export interface ReviewCheckRecord {
  id: string;
  feature_id: string;
  phase: PhaseId;
  tool: ReviewTool;
  status: ReviewCheckStatus;
  summary: string;
  changed_files: string[];
  initiated_by: string;
  created_at: string;
}

export interface ReviewFinding {
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rule_id: string | null;
  file_path: string | null;
  line_number: number | null;
  message: string;
}

export interface ReviewExecutionResult {
  tool: ReviewTool;
  status: ReviewCheckStatus;
  summary: string;
  changed_files: string[];
  findings: ReviewFinding[];
}

export interface LearningRecord {
  id: string;
  feature_id: string;
  phase: PhaseId;
  title: string;
  content: string;
  category: LearningCategory;
  tags: string[];
  created_by: string;
  created_at: string;
}

export interface RelatedLearningRecord {
  id: string;
  title: string;
  category: string;
  content: string;
  confidence_score: number;
  source_feature_id: string;
  shared_domains: string[];
  shared_domain_count: number;
}

export interface SkillProposalCandidate {
  topic_key: string;
  display_name: string;
  status: SkillProposalStatus;
  evidence_count: number;
  feature_count: number;
  sample_tags: string[];
  latest_learning_at: string;
  recent_examples: Array<{
    learning_id: string;
    title: string;
    feature_id: string;
    created_at: string;
  }>;
}

export interface SkillProposalRecord {
  topic_key: string;
  display_name: string;
  status: SkillProposalReviewStatus;
  skill_name: string;
  skill_category: string;
  draft_markdown: string;
  validation_errors: string[];
  validation_warnings: string[];
  published_path: string | null;
  decision_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_by: string | null;
  approved_at: string | null;
  published_by: string | null;
  published_at: string | null;
}

export interface AgentInvocationRecord {
  id: string;
  feature_id: string;
  phase: PhaseId;
  agent_name: string;
  operation: string | null;
  skills_used: string[];
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
}

export interface PullRequestRecord {
  feature_id: string;
  pr_url: string;
  pr_number: number;
}

export interface FeatureCommitRecord {
  feature_id: string;
  commit_hash: string;
  phase: PhaseId;
  message?: string;
  files_changed?: number;
  insertions?: number;
  deletions?: number;
  committed_at: string;
  committed_by: string;
}

export interface MergeRecord {
  feature_id: string;
  merged_at: string;
  merged_by: string;
  pr_url?: string;
  pr_number?: number;
}

export interface PhaseAgentInstructions {
  name: string;
  role_summary: string;
  constraints: string[];
}

export interface PhaseContextBundle {
  feature: FeatureRecord;
  phase: PhaseContract;
  agent: PhaseAgentInstructions;
  automation: AutomationDecision;
  invocation: {
    id: string;
    agent_name: string;
    started_at: string;
    skills_used: string[];
  } | null;
  workflow: {
    open_blockers: string[];
    open_gates: string[];
    open_gate_records: QualityGateRecord[];
    open_findings: string[];
    pending_claims: string[];
    claims_needing_review_count: number;
  };
  artifacts: Partial<Record<ArtifactOutputType, PhaseArtifact>>;
  development_evals: {
    mode: DevelopmentEvalMode;
    latest_plan: PhaseArtifact | null;
    latest_run: PhaseArtifact | null;
    expected_artifacts: Array<'eval_plan' | 'eval_run'>;
    expected_gate: 'eval_readiness' | null;
    open_readiness_gate: QualityGateRecord | null;
    requirements: string[];
    status_summary: string[];
    harness_prompt_block: string[];
    non_interference_rules: string[];
  };
  skills: {
    resolved: ResolvedSkill[];
    fallback_used: boolean;
  };
  verification: {
    watched_phase: boolean;
    required_claims: string[];
    required_checks: string[];
    review_mode: 'none' | 'security' | 'watched_phase';
  };
  learnings: Array<{
    id: string;
    title: string;
    category: LearningCategory;
    summary: string;
    source: 'feature' | 'related';
    source_feature_id?: string;
    shared_domains?: string[];
  }>;
}
