/**
 * Odin Dashboard - Database Types
 * Derived from Supabase migrations 001-017
 */

// ============================================================
// Enums
// ============================================================

export const PHASE_NAMES: Record<string, string> = {
  '0': 'Planning',
  '1': 'Discovery',
  '2': 'Architect',
  '3': 'Guardian',
  '4': 'Builder',
  '5': 'Integrator',
  '6': 'Documenter',
  '7': 'Release',
  '8': 'Complete',
} as const;

export type Phase = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type FeatureStatus = 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
export type Severity = 'ROUTINE' | 'EXPEDITED' | 'CRITICAL';
export type EvalHealth = 'HEALTHY' | 'CONCERNING' | 'CRITICAL';
export type AlertSeverity = 'WARNING' | 'CRITICAL';
export type GateStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type BlockerSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BlockerStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED';
export type TransitionType = 'FORWARD' | 'BACKWARD' | 'ESCALATION';
export type LearningCategory =
  | 'DECISION'
  | 'PATTERN'
  | 'GOTCHA'
  | 'CONVENTION'
  | 'ARCHITECTURE'
  | 'RATIONALE'
  | 'OPTIMIZATION'
  | 'INTEGRATION';
export type LearningImportance = 'HIGH' | 'MEDIUM' | 'LOW';
export type LearningConflictType = 'CONTRADICTION' | 'SCOPE_OVERLAP' | 'VERSION_DRIFT';
export type LearningConflictStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DEFERRED';
export type BlockerType =
  | 'SPEC_THRASHING'
  | 'MAX_ITERATIONS_REACHED'
  | 'TOKEN_BUDGET_EXCEEDED'
  | 'VALIDATION_FAILED'
  | 'IMPLEMENTATION_IMPOSSIBLE'
  | 'TECHNICAL_IMPOSSIBILITY'
  | 'BREAKING_CHANGE_DETECTED'
  | 'HUMAN_DECISION_REQUIRED';

// ============================================================
// Core table row types
// ============================================================

export interface Feature {
  id: string;
  name: string;
  complexity_level: 1 | 2 | 3;
  severity: Severity;
  current_phase: Phase;
  status: FeatureStatus;
  epic_id: string | null;
  parent_feature_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  requirements_path: string | null;
  spec_path: string | null;
  assigned_agent: string | null;
  // Git tracking (Migration 017)
  branch_name: string | null;
  base_branch: string | null;
  dev_initials: string | null;
  pr_url: string | null;
  pr_number: number | null;
  merged_at: string | null;
  // Author tracking (Migration 023)
  author: string | null;
}

export interface PhaseTransition {
  id: number;
  feature_id: string;
  from_phase: Phase;
  to_phase: Phase;
  transitioned_at: string;
  transitioned_by: string;
  transition_type: TransitionType;
  notes: string | null;
}

export interface QualityGate {
  id: number;
  feature_id: string;
  gate_name: string;
  phase: Phase;
  status: GateStatus;
  approver: string;
  approved_at: string;
  approval_notes: string | null;
  decision_log: string | null;
}

export interface Blocker {
  id: number;
  feature_id: string;
  blocker_type: BlockerType;
  phase: Phase;
  status: BlockerStatus;
  severity: BlockerSeverity;
  title: string;
  description: string;
  created_at: string;
  created_by: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  escalation_notes: string | null;
}

export interface Learning {
  id: string;
  predecessor_id: string | null;
  iteration_number: number;
  feature_id: string | null;
  task_id: string | null;
  category: LearningCategory;
  title: string;
  content: string;
  delta_summary: string | null;
  confidence_score: number;
  validation_count: number;
  last_validated_at: string | null;
  validated_by: string[];
  propagated_to: string[];
  propagated_at: string | null;
  propagation_summary: string | null;
  importance: LearningImportance;
  tags: string[];
  phase: Phase | null;
  agent: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  is_superseded: boolean;
  superseded_at: string | null;
  superseded_by: string | null;
}

export interface LearningConflict {
  id: string;
  learning_a_id: string;
  learning_b_id: string;
  conflict_type: LearningConflictType;
  description: string;
  detected_at: string;
  detected_by: string | null;
  status: LearningConflictStatus;
  resolution: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  winning_learning_id: string | null;
}

export interface FeatureEval {
  id: string;
  feature_id: string;
  computed_at: string;
  efficiency_score: number | null;
  quality_score: number | null;
  overall_score: number | null;
  health_status: EvalHealth;
  efficiency_breakdown: EfficiencyBreakdown;
  quality_breakdown: QualityBreakdown;
  learning_metrics: LearningMetrics;
  raw_metrics: Record<string, unknown>;
}

export interface EfficiencyBreakdown {
  total_duration_minutes?: number;
  expected_duration_minutes?: number;
  duration_ratio?: number;
  agent_invocations?: number;
  total_agent_duration_ms?: number;
  iterations?: number;
}

export interface QualityBreakdown {
  approvals?: number;
  rejections?: number;
  total_gates?: number;
  approval_rate?: number;
  thrashing_incidents?: number;
  blocker_count?: number;
}

export interface LearningMetrics {
  total_learnings?: number;
  high_confidence?: number;
  propagated?: number;
}

export interface SystemHealthEval {
  id: string;
  computed_at: string;
  period_days: 7 | 30 | 90;
  overall_health_score: number;
  health_status: EvalHealth;
  workflow_metrics: WorkflowMetrics;
  quality_metrics: SystemQualityMetrics;
  learning_metrics: SystemLearningMetrics;
  alerts: SystemAlert[];
}

export interface WorkflowMetrics {
  features_completed?: number;
  features_blocked?: number;
  features_in_progress?: number;
  avg_cycle_time_hours?: number;
}

export interface SystemQualityMetrics {
  avg_iterations_to_approval?: number;
  thrashing_rate?: number;
}

export interface SystemLearningMetrics {
  total_learnings?: number;
  high_confidence_learnings?: number;
  open_conflicts?: number;
}

export interface SystemAlert {
  severity: AlertSeverity;
  dimension: string;
  message: string;
  current_value: number;
  threshold: number;
}

export interface AgentEval {
  id: string;
  agent_name: string;
  period_start: string;
  period_end: string;
  metrics: Record<string, unknown>;
  performance_score: number | null;
}

export interface EvalAlert {
  id: string;
  severity: AlertSeverity;
  dimension: string;
  message: string;
  current_value: number;
  threshold: number;
  source_type: 'feature' | 'system' | 'agent';
  source_id: string | null;
  feature_id: string | null;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
}

export interface AgentInvocation {
  id: string;
  feature_id: string;
  phase: Phase;
  agent_name: string;
  operation: string | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  notes: string | null;
  // Skills tracking (Migration 024)
  skills_used: string[] | null;
}

export interface IterationTracking {
  id: number;
  feature_id: string;
  iteration_number: number;
  spec_version: string;
  spec_score: number | null;
  issues_found: number;
  issues_resolved: number;
  spec_changes_percent: number;
  convergence_detected: boolean;
  thrashing_detected: boolean;
  recorded_at: string;
}

export interface FeatureCommit {
  id: string;
  feature_id: string;
  commit_hash: string;
  phase: Phase;
  message: string | null;
  files_changed: number | null;
  insertions: number | null;
  deletions: number | null;
  committed_at: string;
  committed_by: string | null;
  created_at: string;
}

// ============================================================
// View types (computed/joined)
// ============================================================

export interface ActiveLearning {
  id: string;
  predecessor_id: string | null;
  iteration_number: number;
  feature_id: string | null;
  task_id: string | null;
  category: LearningCategory;
  title: string;
  content: string;
  delta_summary: string | null;
  confidence_score: number;
  validation_count: number;
  last_validated_at: string | null;
  importance: LearningImportance;
  tags: string[];
  phase: Phase | null;
  agent: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  propagated_to: string[];
  propagated_at: string | null;
  feature_name: string | null;
  is_propagated: boolean;
  ready_for_propagation: boolean;
  has_successors: boolean;
  propagation_status: PropagationStatusLabel;
  total_targets: number;
  propagated_count: number;
}

export interface PropagationQueueItem {
  id: string;
  category: LearningCategory;
  title: string;
  content: string;
  confidence_score: number;
  validation_count: number;
  importance: LearningImportance;
  feature_id: string | null;
  feature_name: string | null;
  tags: string[];
  created_at: string;
  created_by: string | null;
  suggested_summary: string;
}

export interface OpenConflict {
  id: string;
  conflict_type: LearningConflictType;
  description: string;
  status: LearningConflictStatus;
  detected_at: string;
  detected_by: string | null;
  learning_a_id: string;
  learning_a_title: string;
  learning_a_category: LearningCategory;
  learning_a_confidence: number;
  learning_a_feature_id: string | null;
  learning_b_id: string;
  learning_b_title: string;
  learning_b_category: LearningCategory;
  learning_b_confidence: number;
  learning_b_feature_id: string | null;
  hours_open: number;
}

export interface FeatureHealthOverview {
  feature_id: string;
  feature_name: string;
  feature_status: FeatureStatus;
  current_phase: Phase;
  complexity_level: 1 | 2 | 3;
  last_eval_at: string | null;
  overall_score: number | null;
  health_status: EvalHealth | null;
  efficiency_score: number | null;
  quality_score: number | null;
  total_duration_ms: number;
  active_alerts: number;
}

export interface AllFeatureSummary {
  feature_id: string;
  feature_name: string;
  feature_status: FeatureStatus;
  current_phase: Phase;
  complexity_level: 1 | 2 | 3;
  severity: Severity;
  created_at: string;
  completed_at: string | null;
  branch_name: string | null;
  pr_url: string | null;
  pr_number: number | null;
  merged_at: string | null;
  author: string | null;
  last_eval_at: string | null;
  overall_score: number | null;
  health_status: EvalHealth | null;
  efficiency_score: number | null;
  quality_score: number | null;
  total_duration_ms: number;
  active_alerts: number;
}

export interface ActiveEvalAlert {
  id: string;
  severity: AlertSeverity;
  dimension: string;
  message: string;
  current_value: number;
  threshold: number;
  source_type: 'feature' | 'system' | 'agent';
  feature_id: string | null;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  feature_name: string | null;
  hours_active: number;
  is_acknowledged: boolean;
}

export interface LearningChainSummary {
  chain_root_id: string;
  chain_length: number;
  latest_iteration: number;
  current_confidence: number;
  original_title: string;
  current_learning_id: string;
  chain_started_at: string;
  last_evolved_at: string;
}

// ============================================================
// Propagation types (Migration 021)
// ============================================================

export type PropagationTargetType = 'agents_md' | 'skill' | 'agent_definition';
export type PropagationStatusLabel = 'no_targets' | 'pending' | 'partial' | 'complete';

export interface SkillPropagationItem {
  learning_id: string;
  title: string;
  category: LearningCategory;
  content: string;
  confidence_score: number;
  feature_id: string | null;
  target_type: PropagationTargetType;
  target_path: string | null;
  relevance_score: number;
}

export interface SkillPropagationItemWithStatus extends SkillPropagationItem {
  is_propagated: boolean;
  propagated_at: string | null;
  propagated_by: string | null;
}

export interface PropagationStatus {
  target_type: PropagationTargetType;
  target_path: string | null;
  relevance_score: number;
  is_propagated: boolean;
  propagated_at: string | null;
  propagated_by: string | null;
}

export interface LearningPropagationOverview {
  learning_id: string;
  title: string;
  category: LearningCategory;
  confidence_score: number;
  feature_id: string | null;
  total_targets: number;
  propagated_count: number;
  pending_count: number;
  propagation_status: PropagationStatusLabel;
}

// ============================================================
// Propagation History (display-only, past tense)
// ============================================================

export interface PropagationHistoryItem {
  id: string;
  learning_id: string;
  target_type: string;
  target_path: string | null;
  propagated_at: string;
  propagated_by: string;
  section: string | null;
  learning_title: string;
  learning_category: LearningCategory;
}

// ============================================================
// Audit Log
// ============================================================

export interface AuditLogEntry {
  id: number;
  feature_id: string | null;
  operation: string;
  agent_name: string;
  timestamp: string;
  details: Record<string, unknown> | null;
}

// ============================================================
// RPC function return types
// ============================================================

export interface FeatureStatusResult {
  feature_id: string;
  feature_name: string;
  complexity_level: number;
  severity: Severity;
  current_phase: Phase;
  status: FeatureStatus;
  assigned_agent: string | null;
  total_duration_ms: number;
  phase_count: number;
  open_blockers_count: number;
  pending_gates_count: number;
  total_transitions: number;
  total_learnings: number;
  active_invocations: number;
  created_at: string;
  updated_at: string;
  // Git tracking (Migration 017)
  branch_name: string | null;
  base_branch: string | null;
  dev_initials: string | null;
  pr_url: string | null;
  pr_number: number | null;
  merged_at: string | null;
  // Author tracking (Migration 023)
  author: string | null;
}

export interface PhaseDuration {
  phase: Phase;
  phase_name: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  agent_invocation_count: number;
  total_agent_duration_ms: number;
}

export interface AgentDuration {
  agent_name: string;
  phase: Phase;
  invocation_count: number;
  total_duration_ms: number;
  avg_duration_ms: number;
  min_duration_ms: number | null;
  max_duration_ms: number | null;
}

export interface LearningChainItem {
  learning_id: string;
  learning_predecessor_id: string | null;
  learning_iteration_number: number;
  learning_title: string;
  learning_content: string;
  learning_delta_summary: string | null;
  learning_confidence_score: number;
  learning_is_superseded: boolean;
  learning_created_at: string;
  chain_position: number;
}

// ============================================================
// Phase Outputs (Migration 026)
// ============================================================

export type PhaseOutputType = 'requirements' | 'perspectives' | 'tasks';

export interface PhaseOutput {
  id: string;
  feature_id: string;
  phase: Phase;
  output_type: PhaseOutputType;
  content: unknown;
  created_by: string;
  created_at: string;
}

export interface RequirementItem {
  id: string;
  title: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PerspectiveItem {
  name: string;
  rating: 'Good' | 'Needs Work' | 'Blocking';
  notes: string;
}

export interface TaskItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'done';
}

// ============================================================
// Feature Archives (storage bucket metadata)
// ============================================================

export interface FeatureArchive {
  id: string;
  feature_id: string;
  storage_path: string;
  summary: string;
  files_archived: string[];
  total_size_bytes: number | null;
  release_version: string | null;
  release_notes: string | null;
  archived_at: string;
  archived_by: string;
}
