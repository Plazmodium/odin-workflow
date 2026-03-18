/**
 * Odin Runtime Domain Types
 * Version: 0.1.0
 */

export const PHASE_IDS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

export const FEATURE_STATUSES = ['PLANNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'] as const;

export const PHASE_OUTCOMES = ['completed', 'blocked', 'needs_rework'] as const;

export const REVIEW_TOOLS = ['semgrep'] as const;

export const REVIEW_CHECK_STATUSES = ['queued', 'passed', 'failed'] as const;

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
] as const;

export type PhaseId = (typeof PHASE_IDS)[number];
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];
export type PhaseOutcome = (typeof PHASE_OUTCOMES)[number];
export type ReviewTool = (typeof REVIEW_TOOLS)[number];
export type ReviewCheckStatus = (typeof REVIEW_CHECK_STATUSES)[number];
export type LearningCategory = (typeof LEARNING_CATEGORIES)[number];
export type ArtifactOutputType = (typeof ARTIFACT_OUTPUT_TYPES)[number];

export type PersistedTargetType = 'skill' | 'agent_definition' | 'agents_md';

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

export interface ClaimVerificationSummary {
  claim_id: string;
  claim_type: string;
  agent_name: string;
  risk_level: string;
  policy_verdict: string | null;
  watcher_verdict: string | null;
  final_status: string;
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

export interface PhaseAgentInstructions {
  name: string;
  role_summary: string;
  constraints: string[];
}

export interface PhaseContextBundle {
  feature: FeatureRecord;
  phase: PhaseContract;
  agent: PhaseAgentInstructions;
  workflow: {
    open_blockers: string[];
    open_gates: string[];
    open_findings: string[];
    pending_claims: string[];
  };
  artifacts: Partial<Record<ArtifactOutputType, PhaseArtifact>>;
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
