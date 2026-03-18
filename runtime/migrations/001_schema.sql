-- ============================================================================
-- Odin SDD Framework - Consolidated Schema
-- Version: 1.1.0
-- Created: 2026-02-16
-- Updated: 2026-02-16 (reconciled with live Supabase DB)
-- Description: Complete database schema for Odin. Run this first on a fresh
--   Supabase project. Includes all tables, enums, indexes, RLS policies, and
--   triggers. Functions and views are in separate files.
--
-- Order matters: Enums -> Tables (respecting FK dependencies) -> Indexes -> RLS
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Workflow phases (0-8)
CREATE TYPE phase AS ENUM ('0', '1', '2', '3', '4', '5', '6', '7', '8');
COMMENT ON TYPE phase IS 'Workflow phases: 0=Planning, 1=Discovery, 2=Architect, 3=Guardian, 4=Builder, 5=Integrator, 6=Documenter, 7=Release, 8=Complete';

-- Feature status
CREATE TYPE feature_status AS ENUM ('IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- Feature severity (for prioritization)
CREATE TYPE severity AS ENUM ('ROUTINE', 'EXPEDITED', 'CRITICAL');

-- Blocker types
CREATE TYPE blocker_type AS ENUM (
  'SPEC_THRASHING',
  'MAX_ITERATIONS_REACHED',
  'TOKEN_BUDGET_EXCEEDED',
  'VALIDATION_FAILED',
  'IMPLEMENTATION_IMPOSSIBLE',
  'TECHNICAL_IMPOSSIBILITY',
  'BREAKING_CHANGE_DETECTED',
  'HUMAN_DECISION_REQUIRED'
);

-- Blocker status
CREATE TYPE blocker_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED');

-- Blocker severity
CREATE TYPE blocker_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- Quality gate status
CREATE TYPE gate_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Phase transition types
CREATE TYPE transition_type AS ENUM ('FORWARD', 'BACKWARD', 'ESCALATION');

-- Learning categories
CREATE TYPE learning_category AS ENUM (
  'DECISION',
  'PATTERN',
  'GOTCHA',
  'CONVENTION',
  'ARCHITECTURE',
  'RATIONALE',
  'OPTIMIZATION',
  'INTEGRATION'
);

-- Learning importance levels
CREATE TYPE learning_importance AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- Conflict status (for concurrent feature conflicts)
CREATE TYPE conflict_status AS ENUM ('DETECTED', 'COORDINATED', 'SERIALIZED', 'RESOLVED');

-- Conflict risk levels
CREATE TYPE conflict_risk AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- Conflict resolution strategies
CREATE TYPE conflict_strategy AS ENUM ('SERIALIZE', 'COORDINATE', 'ALLOW_PARALLEL');

-- Learning conflict status
CREATE TYPE learning_conflict_status AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DEFERRED');

-- Learning conflict types
CREATE TYPE learning_conflict_type AS ENUM ('CONTRADICTION', 'SCOPE_OVERLAP', 'VERSION_DRIFT');

-- Memory categories (for agent memory candidates)
CREATE TYPE memory_category AS ENUM ('DECISION', 'PATTERN', 'GOTCHA', 'BLOCKER', 'CONVENTION', 'ARCHITECTURE', 'RATIONALE');

-- Memory importance levels
CREATE TYPE memory_importance AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- EVALS health status
CREATE TYPE eval_health AS ENUM ('HEALTHY', 'CONCERNING', 'CRITICAL');

-- Alert severity
CREATE TYPE alert_severity AS ENUM ('WARNING', 'CRITICAL');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Features: Central entity tracking work items through the SDD workflow
CREATE TABLE features (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  complexity_level INTEGER NOT NULL CHECK (complexity_level IN (1, 2, 3)),
  severity severity NOT NULL DEFAULT 'ROUTINE',
  current_phase phase NOT NULL DEFAULT '0',
  status feature_status NOT NULL DEFAULT 'IN_PROGRESS',
  epic_id TEXT,
  parent_feature_id TEXT REFERENCES features(id) ON DELETE SET NULL,
  requirements_path TEXT,
  spec_path TEXT,
  assigned_agent TEXT,
  -- Git tracking
  branch_name TEXT,
  base_branch TEXT DEFAULT 'main',
  dev_initials TEXT,
  pr_url TEXT,
  pr_number INTEGER,
  merged_at TIMESTAMPTZ,
  author TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE features IS 'Central tracking table for features going through the SDD workflow';
COMMENT ON COLUMN features.complexity_level IS 'L1=bug/small, L2=feature, L3=epic';
COMMENT ON COLUMN features.branch_name IS 'Git branch name (auto-generated from dev_initials + id)';
COMMENT ON COLUMN features.author IS 'Human developer name (display name)';
COMMENT ON COLUMN features.dev_initials IS 'Developer initials for branch naming';

-- Phase transitions: Track movement through workflow phases
CREATE TABLE phase_transitions (
  id SERIAL PRIMARY KEY,
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  from_phase phase NOT NULL,
  to_phase phase NOT NULL,
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  transitioned_by TEXT NOT NULL,
  transition_type transition_type NOT NULL DEFAULT 'FORWARD',
  notes TEXT
);

COMMENT ON TABLE phase_transitions IS 'Audit trail of all phase changes for features';

-- Quality gates: Approval checkpoints in the workflow
CREATE TABLE quality_gates (
  id SERIAL PRIMARY KEY,
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  gate_name TEXT NOT NULL,
  phase phase NOT NULL,
  status gate_status NOT NULL DEFAULT 'PENDING',
  approver TEXT NOT NULL,
  approved_at TIMESTAMPTZ DEFAULT now(),
  approval_notes TEXT,
  decision_log TEXT,
  UNIQUE(feature_id, gate_name, phase)
);

COMMENT ON TABLE quality_gates IS 'Approval gates that must pass before phase transitions';

-- Blockers: Issues preventing progress
CREATE TABLE blockers (
  id SERIAL PRIMARY KEY,
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  blocker_type blocker_type NOT NULL,
  phase phase NOT NULL,
  status blocker_status NOT NULL DEFAULT 'OPEN',
  severity blocker_severity NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_notes TEXT,
  escalation_notes TEXT
);

COMMENT ON TABLE blockers IS 'Issues blocking feature progress';

-- Work in progress: File-level locking for concurrent feature work
CREATE TABLE work_in_progress (
  id SERIAL PRIMARY KEY,
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  lock_type TEXT NOT NULL CHECK (lock_type IN ('FEATURE', 'FILE')),
  locked_by TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(feature_id, file_path)
);

COMMENT ON TABLE work_in_progress IS 'File-level locking for concurrent feature work';

-- Conflict detection: Track detected conflicts between concurrent features
CREATE TABLE conflict_detection (
  id SERIAL PRIMARY KEY,
  feature_a_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  feature_b_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  conflict_risk conflict_risk NOT NULL DEFAULT 'MEDIUM',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detected_phase phase NOT NULL,
  status conflict_status NOT NULL DEFAULT 'DETECTED',
  strategy conflict_strategy NOT NULL DEFAULT 'COORDINATE',
  notes TEXT,
  CHECK (feature_a_id < feature_b_id)
);

COMMENT ON TABLE conflict_detection IS 'Conflicts detected between concurrent features on shared files';

-- Iteration tracking: Track spec revision iterations
CREATE TABLE iteration_tracking (
  id SERIAL PRIMARY KEY,
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  iteration_number INTEGER NOT NULL,
  spec_version TEXT NOT NULL,
  spec_score NUMERIC(3,2),
  issues_found INTEGER NOT NULL DEFAULT 0,
  issues_resolved INTEGER NOT NULL DEFAULT 0,
  spec_changes_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  convergence_detected BOOLEAN NOT NULL DEFAULT false,
  thrashing_detected BOOLEAN NOT NULL DEFAULT false,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(feature_id, iteration_number)
);

COMMENT ON TABLE iteration_tracking IS 'Tracks iterations (back-and-forth) in spec development';

-- Audit log: Comprehensive operation logging
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  feature_id TEXT REFERENCES features(id) ON DELETE SET NULL,
  operation TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB
);

COMMENT ON TABLE audit_log IS 'Audit trail for all significant operations';

-- ============================================================================
-- AGENT INVOCATIONS (Duration tracking)
-- ============================================================================

CREATE TABLE agent_invocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  phase phase NOT NULL,
  agent_name TEXT NOT NULL,
  operation TEXT,
  skills_used TEXT[],
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE agent_invocations IS 'Track agent work duration per phase (replaces token tracking)';
COMMENT ON COLUMN agent_invocations.skills_used IS 'Array of skill paths injected (e.g., frontend/nextjs-dev)';

-- ============================================================================
-- GIT COMMIT TRACKING
-- ============================================================================

CREATE TABLE feature_commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  commit_hash TEXT NOT NULL,
  phase phase NOT NULL,
  message TEXT,
  files_changed INTEGER,
  insertions INTEGER,
  deletions INTEGER,
  committed_at TIMESTAMPTZ DEFAULT now(),
  committed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE feature_commits IS 'Git commits associated with each feature';

-- ============================================================================
-- PHASE OUTPUTS (Structured agent artifacts)
-- ============================================================================

CREATE TABLE phase_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  phase phase NOT NULL,
  output_type TEXT NOT NULL,  -- 'requirements', 'perspectives', 'tasks'
  content JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE phase_outputs IS 'Structured outputs from each phase (requirements, perspectives, tasks)';
COMMENT ON COLUMN phase_outputs.content IS 'JSONB acceptable here: shape varies by output_type';

-- ============================================================================
-- MEMORIES (Knowledge persistence)
-- ============================================================================

CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id VARCHAR(50) REFERENCES features(id) ON DELETE SET NULL,
  category memory_category NOT NULL,
  importance memory_importance NOT NULL DEFAULT 'MEDIUM',
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  rationale TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  phase phase,
  agent VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by VARCHAR(100),
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  search_vector TSVECTOR
);

COMMENT ON TABLE memories IS 'Structured knowledge persistence for agent memory candidates';

-- ============================================================================
-- FEATURE ARCHIVES (Completed feature documentation)
-- ============================================================================

CREATE TABLE feature_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id VARCHAR(50) NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  summary TEXT NOT NULL,
  files_archived TEXT[] NOT NULL DEFAULT '{}'::text[],
  total_size_bytes INTEGER DEFAULT 0,
  spec_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  release_version VARCHAR(50),
  release_notes TEXT,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_by VARCHAR(50) NOT NULL DEFAULT 'Release',
  search_vector TSVECTOR,
  UNIQUE(feature_id)
);

COMMENT ON TABLE feature_archives IS 'Archived documentation for completed features';

-- ============================================================================
-- LEARNINGS (Knowledge evolution)
-- ============================================================================

CREATE TABLE learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  predecessor_id UUID REFERENCES learnings(id) ON DELETE SET NULL,
  iteration_number INTEGER NOT NULL DEFAULT 1,
  feature_id TEXT REFERENCES features(id) ON DELETE SET NULL,
  task_id TEXT,
  category learning_category NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  delta_summary TEXT,
  confidence_score NUMERIC(3,2) NOT NULL DEFAULT 0.50
    CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
  validation_count INTEGER NOT NULL DEFAULT 0,
  last_validated_at TIMESTAMPTZ,
  validated_by TEXT[] DEFAULT '{}'::text[],
  propagated_to TEXT[] DEFAULT '{}'::text[],  -- Legacy: kept for backward compat, use relational tables
  propagated_at TIMESTAMPTZ,
  propagation_summary TEXT,
  importance learning_importance NOT NULL DEFAULT 'MEDIUM',
  tags TEXT[] DEFAULT '{}'::text[],
  phase phase,
  agent VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(100),
  is_superseded BOOLEAN NOT NULL DEFAULT false,
  superseded_at TIMESTAMPTZ,
  superseded_by UUID REFERENCES learnings(id) ON DELETE SET NULL,
  search_vector TSVECTOR
);

COMMENT ON TABLE learnings IS 'Evolving knowledge base with confidence scoring and validation';
COMMENT ON COLUMN learnings.predecessor_id IS 'Links to the previous version (L_n -> L_{n+1} chain)';
COMMENT ON COLUMN learnings.confidence_score IS '0.00-1.00, increases with validation (+0.15) and references (+0.10)';
COMMENT ON COLUMN learnings.propagated_to IS 'LEGACY: Use learning_propagation_targets instead';

-- Learning conflicts: Detect contradicting learnings
CREATE TABLE learning_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_a_id UUID NOT NULL REFERENCES learnings(id) ON DELETE CASCADE,
  learning_b_id UUID NOT NULL REFERENCES learnings(id) ON DELETE CASCADE,
  conflict_type learning_conflict_type NOT NULL,
  description TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detected_by VARCHAR(100),
  status learning_conflict_status NOT NULL DEFAULT 'OPEN',
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(100),
  winning_learning_id UUID REFERENCES learnings(id) ON DELETE SET NULL,
  CHECK (learning_a_id <> learning_b_id),
  UNIQUE(learning_a_id, learning_b_id)
);

COMMENT ON TABLE learning_conflicts IS 'Detected conflicts between learnings that need resolution';

-- Learning propagation targets: Where learnings SHOULD go
CREATE TABLE learning_propagation_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_id UUID NOT NULL REFERENCES learnings(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('agents_md', 'skill', 'agent_definition')),
  target_path TEXT,
  relevance_score NUMERIC(3,2) NOT NULL CHECK (relevance_score >= 0.00 AND relevance_score <= 1.00),
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Invariant: agents_md => NULL path, skill/agent_definition => NOT NULL path
  CHECK (
    (target_type = 'agents_md' AND target_path IS NULL)
    OR (target_type IN ('skill', 'agent_definition') AND target_path IS NOT NULL)
  )
);

COMMENT ON TABLE learning_propagation_targets IS 'Declared targets for learning propagation (where they SHOULD go)';

-- Learning propagations: Where learnings HAVE BEEN propagated
CREATE TABLE learning_propagations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_id UUID NOT NULL REFERENCES learnings(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('agents_md', 'skill', 'agent_definition')),
  target_path TEXT,
  propagated_at TIMESTAMPTZ DEFAULT now(),
  propagated_by TEXT NOT NULL,
  section TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (
    (target_type = 'agents_md' AND target_path IS NULL)
    OR (target_type IN ('skill', 'agent_definition') AND target_path IS NOT NULL)
  )
);

COMMENT ON TABLE learning_propagations IS 'Completed propagation records (audit trail)';

-- ============================================================================
-- EVALS (Performance diagnostics)
-- ============================================================================

-- Feature evaluations: Performance snapshots for completed features
CREATE TABLE feature_evals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  efficiency_score NUMERIC(5,2) CHECK (efficiency_score >= 0 AND efficiency_score <= 100),
  quality_score NUMERIC(5,2) CHECK (quality_score >= 0 AND quality_score <= 100),
  overall_score NUMERIC(5,2) CHECK (overall_score >= 0 AND overall_score <= 100),
  health_status eval_health NOT NULL,
  efficiency_breakdown JSONB NOT NULL DEFAULT '{}',
  quality_breakdown JSONB NOT NULL DEFAULT '{}',
  learning_metrics JSONB NOT NULL DEFAULT '{}',
  raw_metrics JSONB NOT NULL DEFAULT '{}'
);

COMMENT ON TABLE feature_evals IS 'Performance evaluation snapshots for features';

-- System health evaluations: Periodic system-wide health
CREATE TABLE system_health_evals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_days INTEGER NOT NULL CHECK (period_days IN (7, 30, 90)),
  overall_health_score NUMERIC(5,2) NOT NULL CHECK (overall_health_score >= 0 AND overall_health_score <= 100),
  health_status eval_health NOT NULL,
  workflow_metrics JSONB NOT NULL DEFAULT '{}',
  quality_metrics JSONB NOT NULL DEFAULT '{}',
  learning_metrics JSONB NOT NULL DEFAULT '{}',
  alerts JSONB NOT NULL DEFAULT '[]'
);

COMMENT ON TABLE system_health_evals IS 'Periodic system-wide health snapshots';

-- Agent evaluations: Agent performance by time period
CREATE TABLE agent_evals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name VARCHAR(50) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  performance_score NUMERIC(5,2) CHECK (performance_score >= 0 AND performance_score <= 100),
  UNIQUE(agent_name, period_start, period_end)
);

COMMENT ON TABLE agent_evals IS 'Agent performance metrics aggregated by time period';

-- Eval alerts: Active alerts from threshold breaches
CREATE TABLE eval_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity alert_severity NOT NULL,
  dimension VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  current_value NUMERIC NOT NULL,
  threshold NUMERIC NOT NULL,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('feature', 'system', 'agent')),
  source_id UUID,
  feature_id TEXT REFERENCES features(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(100),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(100),
  resolution_notes TEXT
);

COMMENT ON TABLE eval_alerts IS 'Active alerts from evaluation threshold breaches';

-- ============================================================================
-- BATCH EXECUTION (Code mode analytics)
-- ============================================================================

-- Batch executions: Analytics log for batch script runs
CREATE TABLE batch_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_name VARCHAR(100),
  script_hash VARCHAR(64),
  template_used VARCHAR(100),
  total_steps INTEGER NOT NULL,
  completed_steps INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  failed_step INTEGER,
  error_message TEXT,
  duration_ms INTEGER,
  feature_id TEXT REFERENCES features(id) ON DELETE SET NULL,
  agent_name VARCHAR(100),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  script_json JSONB,
  results_json JSONB
);

COMMENT ON TABLE batch_executions IS 'Analytics log for batch script executions';

-- Batch templates: Pre-defined batch scripts
CREATE TABLE batch_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  params JSONB NOT NULL DEFAULT '[]',
  steps JSONB NOT NULL,
  output_config JSONB NOT NULL DEFAULT '{}',
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  avg_duration_ms NUMERIC,
  success_rate NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE batch_templates IS 'Pre-defined batch script templates';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Features
CREATE INDEX idx_features_status ON features(status);
CREATE INDEX idx_features_phase ON features(current_phase);
CREATE INDEX idx_features_epic ON features(epic_id) WHERE epic_id IS NOT NULL;
CREATE INDEX idx_features_created ON features(created_at DESC);

-- Phase transitions
CREATE INDEX idx_phase_transitions_feature ON phase_transitions(feature_id, transitioned_at DESC);
CREATE INDEX idx_phase_transitions_type ON phase_transitions(transition_type);

-- Quality gates
CREATE INDEX idx_quality_gates_feature ON quality_gates(feature_id);
CREATE INDEX idx_quality_gates_status ON quality_gates(status);

-- Blockers
CREATE INDEX idx_blockers_feature ON blockers(feature_id);
CREATE INDEX idx_blockers_status ON blockers(status);
CREATE INDEX idx_blockers_severity ON blockers(severity);

-- Work in progress
CREATE INDEX idx_wip_feature ON work_in_progress(feature_id);
CREATE INDEX idx_wip_locked_by ON work_in_progress(locked_by);

-- Conflict detection
CREATE INDEX idx_conflicts_features ON conflict_detection(feature_a_id, feature_b_id);
CREATE INDEX idx_conflicts_risk ON conflict_detection(conflict_risk);
CREATE INDEX idx_conflicts_status ON conflict_detection(status);

-- Iteration tracking
CREATE INDEX idx_iteration_feature ON iteration_tracking(feature_id, iteration_number);

-- Audit log
CREATE INDEX idx_audit_feature ON audit_log(feature_id, timestamp DESC);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_operation ON audit_log(operation);

-- Agent invocations
CREATE INDEX idx_agent_invocations_feature ON agent_invocations(feature_id);
CREATE INDEX idx_agent_invocations_agent ON agent_invocations(agent_name);
CREATE INDEX idx_agent_invocations_phase ON agent_invocations(feature_id, phase);

-- Feature commits
CREATE INDEX idx_feature_commits_feature_id ON feature_commits(feature_id);
CREATE INDEX idx_feature_commits_phase ON feature_commits(feature_id, phase);

-- Phase outputs
CREATE UNIQUE INDEX idx_phase_outputs_unique ON phase_outputs(feature_id, phase, output_type);
CREATE INDEX idx_phase_outputs_feature ON phase_outputs(feature_id);

-- Memories
CREATE INDEX idx_memories_feature ON memories(feature_id);
CREATE INDEX idx_memories_category ON memories(category);
CREATE INDEX idx_memories_importance ON memories(importance);
CREATE INDEX idx_memories_created ON memories(created_at DESC);
CREATE INDEX idx_memories_active ON memories(is_archived) WHERE is_archived = false;
CREATE INDEX idx_memories_category_importance ON memories(category, importance) WHERE is_archived = false;
CREATE INDEX idx_memories_tags ON memories USING gin(tags);
CREATE INDEX idx_memories_search ON memories USING gin(search_vector);

-- Feature archives
CREATE INDEX idx_feature_archives_feature_id ON feature_archives(feature_id);
CREATE INDEX idx_feature_archives_archived_at ON feature_archives(archived_at DESC);
CREATE INDEX idx_feature_archives_release_version ON feature_archives(release_version);
CREATE INDEX idx_feature_archives_search ON feature_archives USING gin(search_vector);

-- Learnings
CREATE INDEX idx_learnings_feature ON learnings(feature_id) WHERE feature_id IS NOT NULL;
CREATE INDEX idx_learnings_predecessor ON learnings(predecessor_id) WHERE predecessor_id IS NOT NULL;
CREATE INDEX idx_learnings_category ON learnings(category);
CREATE INDEX idx_learnings_confidence ON learnings(confidence_score DESC) WHERE NOT is_superseded;
CREATE INDEX idx_learnings_active ON learnings(created_at DESC) WHERE NOT is_superseded;
CREATE INDEX idx_learnings_importance ON learnings(importance);
CREATE INDEX idx_learnings_superseded_by ON learnings(superseded_by) WHERE superseded_by IS NOT NULL;
CREATE INDEX idx_learnings_propagation_queue ON learnings(confidence_score DESC)
  WHERE confidence_score >= 0.80 AND array_length(propagated_to, 1) IS NULL AND NOT is_superseded;
CREATE INDEX idx_learnings_tags ON learnings USING gin(tags);
CREATE INDEX idx_learnings_search ON learnings USING gin(search_vector);

-- Learning conflicts
CREATE INDEX idx_learning_conflicts_learning_a ON learning_conflicts(learning_a_id);
CREATE INDEX idx_learning_conflicts_learning_b ON learning_conflicts(learning_b_id);
CREATE INDEX idx_learning_conflicts_status ON learning_conflicts(status);

-- Learning propagation targets (partial unique indexes for NULL-safe dedup)
CREATE UNIQUE INDEX idx_lpt_unique_agents_md ON learning_propagation_targets(learning_id)
  WHERE target_type = 'agents_md';
CREATE UNIQUE INDEX idx_lpt_unique_skill_agent ON learning_propagation_targets(learning_id, target_type, target_path)
  WHERE target_type IN ('skill', 'agent_definition');
CREATE INDEX idx_lpt_learning_id ON learning_propagation_targets(learning_id);
CREATE INDEX idx_lpt_target ON learning_propagation_targets(target_type, target_path);

-- Learning propagations (partial unique indexes)
CREATE UNIQUE INDEX idx_lp_unique_agents_md ON learning_propagations(learning_id)
  WHERE target_type = 'agents_md';
CREATE UNIQUE INDEX idx_lp_unique_skill_agent ON learning_propagations(learning_id, target_type, target_path)
  WHERE target_type IN ('skill', 'agent_definition');
CREATE INDEX idx_lp_learning_id ON learning_propagations(learning_id);
CREATE INDEX idx_lp_target ON learning_propagations(target_type, target_path);

-- Feature evals
CREATE INDEX idx_feature_evals_feature ON feature_evals(feature_id);
CREATE INDEX idx_feature_evals_computed ON feature_evals(computed_at DESC);
CREATE INDEX idx_feature_evals_health ON feature_evals(health_status);

-- System health
CREATE INDEX idx_system_health_computed ON system_health_evals(computed_at DESC);
CREATE INDEX idx_system_health_period ON system_health_evals(period_days, computed_at DESC);
CREATE INDEX idx_system_health_status ON system_health_evals(health_status);

-- Agent evals
CREATE INDEX idx_agent_evals_agent ON agent_evals(agent_name);
CREATE INDEX idx_agent_evals_period ON agent_evals(period_end DESC);

-- Eval alerts
CREATE INDEX idx_eval_alerts_active ON eval_alerts(created_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX idx_eval_alerts_severity ON eval_alerts(severity) WHERE resolved_at IS NULL;
CREATE INDEX idx_eval_alerts_feature ON eval_alerts(feature_id) WHERE feature_id IS NOT NULL;

-- Batch executions
CREATE INDEX idx_batch_executions_template ON batch_executions(template_used);
CREATE INDEX idx_batch_executions_agent ON batch_executions(agent_name);
CREATE INDEX idx_batch_executions_feature ON batch_executions(feature_id);
CREATE INDEX idx_batch_executions_time ON batch_executions(executed_at DESC);
CREATE INDEX idx_batch_executions_success ON batch_executions(success, executed_at DESC);

-- Batch templates
CREATE INDEX idx_batch_templates_name ON batch_templates(name);
CREATE INDEX idx_batch_templates_active ON batch_templates(is_active, usage_count DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_in_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_detection ENABLE ROW LEVEL SECURITY;
ALTER TABLE iteration_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_propagation_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_propagations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_evals ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_evals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_evals ENABLE ROW LEVEL SECURITY;
ALTER TABLE eval_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_templates ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access for API)
CREATE POLICY "Service role full access on features" ON features FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on phase_transitions" ON phase_transitions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on quality_gates" ON quality_gates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on blockers" ON blockers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on work_in_progress" ON work_in_progress FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on conflict_detection" ON conflict_detection FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on iteration_tracking" ON iteration_tracking FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on audit_log" ON audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on agent_invocations" ON agent_invocations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on feature_commits" ON feature_commits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on phase_outputs" ON phase_outputs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on memories" ON memories FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on feature_archives" ON feature_archives FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on learnings" ON learnings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on learning_conflicts" ON learning_conflicts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on learning_propagation_targets" ON learning_propagation_targets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on learning_propagations" ON learning_propagations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on feature_evals" ON feature_evals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on system_health_evals" ON system_health_evals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on agent_evals" ON agent_evals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on eval_alerts" ON eval_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on batch_executions" ON batch_executions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on batch_templates" ON batch_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- Generic updated_at trigger function (used by features, memories)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Learnings-specific updated_at trigger function
CREATE OR REPLACE FUNCTION update_learnings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Batch templates updated_at trigger function
CREATE OR REPLACE FUNCTION update_batch_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER features_updated_at
  BEFORE UPDATE ON features
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER learnings_updated_at
  BEFORE UPDATE ON learnings
  FOR EACH ROW
  EXECUTE FUNCTION update_learnings_updated_at();

CREATE TRIGGER batch_templates_updated_at
  BEFORE UPDATE ON batch_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_templates_updated_at();
