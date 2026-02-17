-- ============================================================================
-- Odin SDD Framework - Consolidated Functions
-- Version: 1.1.0
-- Created: 2026-02-16
-- Updated: 2026-02-16 (reconciled with live Supabase DB)
-- Description: All PostgreSQL functions for Odin. Run after 001_schema.sql.
--   Functions are organized by domain: Core Workflow, Agent Invocations,
--   Git Tracking, Learnings, EVALS, Batch Execution, Memories, Archives.
-- ============================================================================

-- ============================================================================
-- CORE WORKFLOW FUNCTIONS
-- ============================================================================

-- Create a new feature with git branch tracking
CREATE OR REPLACE FUNCTION create_feature(
  p_id TEXT,
  p_name TEXT,
  p_complexity_level INTEGER,
  p_severity severity DEFAULT 'ROUTINE',
  p_epic_id TEXT DEFAULT NULL,
  p_requirements_path TEXT DEFAULT NULL,
  p_created_by TEXT DEFAULT 'system',
  p_dev_initials TEXT DEFAULT NULL,
  p_base_branch TEXT DEFAULT 'main',
  p_author TEXT DEFAULT NULL
) RETURNS TABLE(
  feature_id TEXT,
  feature_name TEXT,
  complexity INTEGER,
  severity_level severity,
  status feature_status,
  branch_name TEXT,
  base_branch TEXT,
  author TEXT
) AS $$
DECLARE
  v_branch_name TEXT;
  v_feature features;
BEGIN
  -- Generate branch name from dev_initials
  IF p_dev_initials IS NOT NULL THEN
    v_branch_name := p_dev_initials || '/feature/' || p_id;
  ELSE
    v_branch_name := 'feature/' || p_id;
  END IF;

  INSERT INTO features (id, name, complexity_level, severity, epic_id, requirements_path, branch_name, base_branch, dev_initials, author)
  VALUES (p_id, p_name, p_complexity_level, p_severity, p_epic_id, p_requirements_path, v_branch_name, p_base_branch, p_dev_initials, p_author)
  RETURNING * INTO v_feature;

  -- Initial phase transition (0 -> 0 = created)
  INSERT INTO phase_transitions (feature_id, from_phase, to_phase, transitioned_by, transition_type, notes)
  VALUES (p_id, '0'::phase, '0'::phase, p_created_by, 'FORWARD', 'Feature created');

  -- Audit log
  INSERT INTO audit_log (feature_id, operation, agent_name, details)
  VALUES (p_id, 'FEATURE_CREATED', p_created_by, jsonb_build_object(
    'name', p_name,
    'complexity_level', p_complexity_level,
    'severity', p_severity::text,
    'branch_name', v_branch_name,
    'author', p_author
  ));

  RETURN QUERY SELECT
    v_feature.id,
    v_feature.name,
    v_feature.complexity_level,
    v_feature.severity,
    v_feature.status,
    v_feature.branch_name,
    v_feature.base_branch,
    v_feature.author;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION create_feature IS 'Create a new feature with git branch tracking';

-- Get comprehensive feature status (column names match dashboard TypeScript FeatureStatusResult)
CREATE OR REPLACE FUNCTION get_feature_status(p_feature_id TEXT)
RETURNS TABLE(
  feature_id TEXT,
  feature_name TEXT,
  complexity_level INTEGER,
  severity severity,
  current_phase phase,
  status feature_status,
  assigned_agent TEXT,
  total_duration_ms BIGINT,
  phase_count BIGINT,
  open_blockers_count BIGINT,
  pending_gates_count BIGINT,
  total_transitions BIGINT,
  total_learnings BIGINT,
  active_invocations BIGINT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  branch_name TEXT,
  base_branch TEXT,
  dev_initials TEXT,
  pr_url TEXT,
  pr_number INTEGER,
  merged_at TIMESTAMPTZ,
  author TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.complexity_level,
    f.severity,
    f.current_phase,
    f.status,
    f.assigned_agent,
    (SELECT coalesce(sum(ai.duration_ms), 0) FROM agent_invocations ai WHERE ai.feature_id = f.id),
    (SELECT count(DISTINCT pt.to_phase) FROM phase_transitions pt WHERE pt.feature_id = f.id),
    (SELECT count(*) FROM blockers b WHERE b.feature_id = f.id AND b.status = 'OPEN'),
    (SELECT count(*) FROM quality_gates qg WHERE qg.feature_id = f.id AND qg.status = 'PENDING'),
    (SELECT count(*) FROM phase_transitions pt WHERE pt.feature_id = f.id),
    (SELECT count(*) FROM learnings l WHERE l.feature_id = f.id),
    (SELECT count(*) FROM agent_invocations ai WHERE ai.feature_id = f.id AND ai.ended_at IS NULL),
    f.created_at,
    f.updated_at,
    f.branch_name,
    f.base_branch,
    f.dev_initials,
    f.pr_url,
    f.pr_number,
    f.merged_at,
    f.author
  FROM features f
  WHERE f.id = p_feature_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION get_feature_status IS 'Get comprehensive feature status including git tracking and metrics';

-- Transition to a new phase (with sequential enforcement)
CREATE OR REPLACE FUNCTION transition_phase(
  p_feature_id TEXT,
  p_to_phase phase,
  p_transitioned_by TEXT,
  p_notes TEXT DEFAULT NULL
) RETURNS phase_transitions AS $$
DECLARE
  v_current_phase phase;
  v_current_int INTEGER;
  v_to_int INTEGER;
  v_transition_type transition_type;
  v_transition phase_transitions;
BEGIN
  -- Get current phase
  SELECT current_phase INTO v_current_phase FROM features WHERE id = p_feature_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature % not found', p_feature_id;
  END IF;

  -- Cast to integers for comparison
  v_current_int := v_current_phase::TEXT::INTEGER;
  v_to_int := p_to_phase::TEXT::INTEGER;

  -- Determine transition type and enforce rules
  IF v_to_int = v_current_int THEN
    -- RESET: Re-running the same phase (allowed, recorded as FORWARD)
    v_transition_type := 'FORWARD';

  ELSIF v_to_int = v_current_int + 1 THEN
    -- FORWARD: Sequential advance by exactly 1 phase (allowed)
    v_transition_type := 'FORWARD';

  ELSIF v_to_int > v_current_int + 1 THEN
    -- SKIP: Attempting to jump more than 1 phase forward (REJECTED)
    RAISE EXCEPTION 'Phase skip not allowed: cannot jump from phase % to phase %. '
      'Phases must advance sequentially (one at a time). '
      'Current: % (%), Target: % (%). '
      'All 8 phases must be executed — complexity level affects depth within each phase, not which phases run.',
      v_current_int, v_to_int,
      v_current_int,
      CASE v_current_int
        WHEN 0 THEN 'Planning'
        WHEN 1 THEN 'Discovery'
        WHEN 2 THEN 'Architect'
        WHEN 3 THEN 'Guardian'
        WHEN 4 THEN 'Builder'
        WHEN 5 THEN 'Integrator'
        WHEN 6 THEN 'Documenter'
        WHEN 7 THEN 'Release'
        ELSE 'Complete'
      END,
      v_to_int,
      CASE v_to_int
        WHEN 0 THEN 'Planning'
        WHEN 1 THEN 'Discovery'
        WHEN 2 THEN 'Architect'
        WHEN 3 THEN 'Guardian'
        WHEN 4 THEN 'Builder'
        WHEN 5 THEN 'Integrator'
        WHEN 6 THEN 'Documenter'
        WHEN 7 THEN 'Release'
        ELSE 'Complete'
      END;

  ELSIF v_to_int < v_current_int THEN
    -- BACKWARD: Going to an earlier phase for rework (allowed)
    v_transition_type := 'BACKWARD';
  END IF;

  -- Update feature
  UPDATE features
  SET current_phase = p_to_phase, updated_at = now()
  WHERE id = p_feature_id;

  -- Record transition
  INSERT INTO phase_transitions (feature_id, from_phase, to_phase, transitioned_by, transition_type, notes)
  VALUES (p_feature_id, v_current_phase, p_to_phase, p_transitioned_by, v_transition_type, p_notes)
  RETURNING * INTO v_transition;

  -- Audit log
  INSERT INTO audit_log (feature_id, operation, agent_name, details) VALUES (
    p_feature_id, 'PHASE_TRANSITION', p_transitioned_by,
    jsonb_build_object(
      'from_phase', v_current_phase::TEXT,
      'to_phase', p_to_phase::TEXT,
      'transition_type', v_transition_type::TEXT
    )
  );

  RETURN v_transition;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION transition_phase IS 'Transition feature to a new phase with sequential enforcement. Forward transitions must advance exactly one phase at a time. Back transitions (rework) can go to any earlier phase.';

-- Complete a feature
CREATE OR REPLACE FUNCTION complete_feature(p_feature_id TEXT, p_completed_by TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check for open blockers
  IF EXISTS (SELECT 1 FROM blockers WHERE feature_id = p_feature_id AND status = 'OPEN') THEN
    RAISE EXCEPTION 'Cannot complete feature % - has open blockers', p_feature_id;
  END IF;

  -- Update feature status AND current_phase to '8' (Complete)
  UPDATE features
  SET status = 'COMPLETED',
      current_phase = '8',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_feature_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature % not found', p_feature_id;
  END IF;

  -- Record the phase transition to Complete
  INSERT INTO phase_transitions (feature_id, from_phase, to_phase, transitioned_by, notes, transition_type)
  VALUES (p_feature_id, '7', '8', p_completed_by, 'Feature completed', 'FORWARD');

  -- Compute feature eval
  PERFORM compute_feature_eval(p_feature_id);

  -- Audit log
  INSERT INTO audit_log (feature_id, operation, agent_name, details) VALUES (
    p_feature_id, 'FEATURE_COMPLETED', p_completed_by,
    jsonb_build_object('completed_at', now())
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION complete_feature IS 'Mark feature as completed, transition to phase 8, compute eval';

-- Create a blocker (matches live DB: uses p_severity, returns INTEGER)
CREATE OR REPLACE FUNCTION create_blocker(
  p_feature_id TEXT,
  p_blocker_type blocker_type,
  p_severity blocker_severity,
  p_title TEXT,
  p_description TEXT,
  p_created_by TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_blocker_id INTEGER;
  v_phase phase;
BEGIN
  -- Get current phase
  SELECT current_phase INTO v_phase FROM features WHERE id = p_feature_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature % not found', p_feature_id;
  END IF;

  -- Create blocker
  INSERT INTO blockers (
    feature_id, blocker_type, phase, severity, title, description, created_by, status
  ) VALUES (
    p_feature_id, p_blocker_type, v_phase, p_severity, p_title, p_description, p_created_by, 'OPEN'
  )
  RETURNING id INTO v_blocker_id;

  -- Update feature status to BLOCKED
  UPDATE features SET status = 'BLOCKED', updated_at = now() WHERE id = p_feature_id;

  -- Audit log
  INSERT INTO audit_log (feature_id, operation, agent_name, details) VALUES (
    p_feature_id, 'BLOCKER_CREATED', p_created_by,
    jsonb_build_object(
      'blocker_id', v_blocker_id,
      'blocker_type', p_blocker_type,
      'severity', p_severity,
      'title', p_title
    )
  );

  RETURN v_blocker_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION create_blocker IS 'Create a blocker and set feature status to BLOCKED';

-- Resolve a blocker (matches live DB: takes INTEGER, returns BOOLEAN)
CREATE OR REPLACE FUNCTION resolve_blocker(
  p_blocker_id INTEGER,
  p_resolved_by TEXT,
  p_resolution_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_feature_id TEXT;
  v_remaining_blockers INTEGER;
BEGIN
  -- Get feature_id from blocker
  SELECT feature_id INTO v_feature_id FROM blockers WHERE id = p_blocker_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blocker % not found', p_blocker_id;
  END IF;

  -- Resolve blocker
  UPDATE blockers
  SET status = 'RESOLVED',
      resolved_by = p_resolved_by,
      resolved_at = now(),
      resolution_notes = p_resolution_notes
  WHERE id = p_blocker_id;

  -- Check if there are remaining open blockers
  SELECT COUNT(*) INTO v_remaining_blockers
  FROM blockers
  WHERE feature_id = v_feature_id AND status = 'OPEN';

  -- If no more blockers, set feature back to IN_PROGRESS
  IF v_remaining_blockers = 0 THEN
    UPDATE features SET status = 'IN_PROGRESS', updated_at = now() WHERE id = v_feature_id;
  END IF;

  -- Audit log
  INSERT INTO audit_log (feature_id, operation, agent_name, details) VALUES (
    v_feature_id, 'BLOCKER_RESOLVED', p_resolved_by,
    jsonb_build_object(
      'blocker_id', p_blocker_id,
      'resolution_notes', p_resolution_notes
    )
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION resolve_blocker IS 'Resolve blocker, return feature to IN_PROGRESS if no blockers remain';

-- Approve a quality gate (matches live DB: uses p_gate_name TEXT, returns INTEGER)
CREATE OR REPLACE FUNCTION approve_gate(
  p_feature_id TEXT,
  p_gate_name TEXT,
  p_status gate_status,
  p_approver TEXT,
  p_approval_notes TEXT DEFAULT NULL,
  p_decision_log TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_gate_id INTEGER;
  v_phase phase;
BEGIN
  -- Get current phase
  SELECT current_phase INTO v_phase FROM features WHERE id = p_feature_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature % not found', p_feature_id;
  END IF;

  -- Create gate record
  INSERT INTO quality_gates (
    feature_id, gate_name, phase, status, approver, approval_notes, decision_log
  ) VALUES (
    p_feature_id, p_gate_name, v_phase, p_status, p_approver, p_approval_notes, p_decision_log
  )
  RETURNING id INTO v_gate_id;

  -- Audit log
  INSERT INTO audit_log (feature_id, operation, agent_name, details) VALUES (
    p_feature_id, 'GATE_' || p_status::TEXT, p_approver,
    jsonb_build_object(
      'gate_id', v_gate_id,
      'gate_name', p_gate_name,
      'status', p_status,
      'phase', v_phase
    )
  );

  RETURN v_gate_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION approve_gate IS 'Approve or reject a quality gate';

-- ============================================================================
-- AGENT INVOCATION FUNCTIONS (Duration tracking)
-- ============================================================================

-- Start an agent invocation (with optional skills tracking)
CREATE OR REPLACE FUNCTION start_agent_invocation(
  p_feature_id TEXT,
  p_phase phase,
  p_agent_name TEXT,
  p_operation TEXT DEFAULT NULL,
  p_skills TEXT[] DEFAULT NULL
) RETURNS agent_invocations
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_invocation agent_invocations;
BEGIN
  INSERT INTO agent_invocations (feature_id, phase, agent_name, operation, skills_used)
  VALUES (p_feature_id, p_phase, p_agent_name, p_operation, p_skills)
  RETURNING * INTO v_invocation;

  -- Write SKILLS_LOADED audit entry when skills are provided
  IF p_skills IS NOT NULL AND array_length(p_skills, 1) > 0 THEN
    INSERT INTO audit_log (feature_id, operation, agent_name, details)
    VALUES (
      p_feature_id,
      'SKILLS_LOADED',
      p_agent_name,
      jsonb_build_object(
        'skills', to_jsonb(p_skills),
        'phase', p_phase::text,
        'operation', p_operation,
        'invocation_id', v_invocation.id::text
      )
    );
  END IF;

  RETURN v_invocation;
END;
$$;

COMMENT ON FUNCTION start_agent_invocation IS 'Start tracking an agent invocation with optional skills';

-- End an agent invocation (computes duration)
CREATE OR REPLACE FUNCTION end_agent_invocation(
  p_invocation_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS agent_invocations AS $$
DECLARE
  v_invocation agent_invocations;
BEGIN
  UPDATE agent_invocations
  SET ended_at = now(),
      duration_ms = EXTRACT(EPOCH FROM (now() - started_at))::INTEGER * 1000,
      notes = COALESCE(p_notes, notes)
  WHERE id = p_invocation_id AND ended_at IS NULL
  RETURNING * INTO v_invocation;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invocation not found or already ended: %', p_invocation_id;
  END IF;

  RETURN v_invocation;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION end_agent_invocation IS 'End an agent invocation and compute duration_ms';

-- Get phase durations for a feature
CREATE OR REPLACE FUNCTION get_phase_durations(p_feature_id TEXT)
RETURNS TABLE (
  phase phase,
  phase_name TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes NUMERIC,
  agent_invocation_count BIGINT,
  total_agent_duration_ms BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH phase_windows AS (
    SELECT
      pt.to_phase,
      pt.transitioned_at AS phase_started,
      LEAD(pt.transitioned_at) OVER (ORDER BY pt.transitioned_at) AS phase_ended
    FROM phase_transitions pt
    WHERE pt.feature_id = p_feature_id
    ORDER BY pt.transitioned_at
  )
  SELECT
    pw.to_phase,
    CASE pw.to_phase
      WHEN '0' THEN 'Planning'
      WHEN '1' THEN 'Discovery'
      WHEN '2' THEN 'Architect'
      WHEN '3' THEN 'Guardian'
      WHEN '4' THEN 'Builder'
      WHEN '5' THEN 'Integrator'
      WHEN '6' THEN 'Documenter'
      WHEN '7' THEN 'Release'
      WHEN '8' THEN 'Complete'
      ELSE 'Unknown'
    END,
    pw.phase_started,
    pw.phase_ended,
    ROUND(EXTRACT(EPOCH FROM (COALESCE(pw.phase_ended, now()) - pw.phase_started)) / 60, 1),
    COALESCE((
      SELECT COUNT(*) FROM agent_invocations ai
      WHERE ai.feature_id = p_feature_id AND ai.phase = pw.to_phase
    ), 0),
    COALESCE((
      SELECT SUM(ai.duration_ms) FROM agent_invocations ai
      WHERE ai.feature_id = p_feature_id AND ai.phase = pw.to_phase AND ai.ended_at IS NOT NULL
    ), 0)
  FROM phase_windows pw
  ORDER BY pw.phase_started;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION get_phase_durations IS 'Get duration breakdown by phase for a feature';

-- Get agent duration breakdown for a feature
CREATE OR REPLACE FUNCTION get_agent_durations(p_feature_id TEXT)
RETURNS TABLE (
  agent_name TEXT,
  phase phase,
  invocation_count BIGINT,
  total_duration_ms BIGINT,
  avg_duration_ms BIGINT,
  min_duration_ms INTEGER,
  max_duration_ms INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai.agent_name,
    ai.phase,
    COUNT(*),
    COALESCE(SUM(ai.duration_ms), 0)::BIGINT,
    COALESCE(AVG(ai.duration_ms), 0)::BIGINT,
    MIN(ai.duration_ms),
    MAX(ai.duration_ms)
  FROM agent_invocations ai
  WHERE ai.feature_id = p_feature_id AND ai.ended_at IS NOT NULL
  GROUP BY ai.agent_name, ai.phase
  ORDER BY ai.phase, ai.agent_name;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION get_agent_durations IS 'Get agent duration statistics for a feature';

-- ============================================================================
-- GIT TRACKING FUNCTIONS
-- ============================================================================

-- Record a commit
CREATE OR REPLACE FUNCTION record_commit(
  p_feature_id TEXT,
  p_commit_hash TEXT,
  p_phase phase,
  p_message TEXT DEFAULT NULL,
  p_files_changed INTEGER DEFAULT NULL,
  p_insertions INTEGER DEFAULT NULL,
  p_deletions INTEGER DEFAULT NULL,
  p_committed_by TEXT DEFAULT 'agent'
) RETURNS feature_commits AS $$
DECLARE
  v_commit feature_commits;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM features WHERE id = p_feature_id) THEN
    RAISE EXCEPTION 'Feature % not found', p_feature_id;
  END IF;

  INSERT INTO feature_commits (
    feature_id, commit_hash, phase, message,
    files_changed, insertions, deletions, committed_by
  ) VALUES (
    p_feature_id, p_commit_hash, p_phase, p_message,
    p_files_changed, p_insertions, p_deletions, p_committed_by
  )
  RETURNING * INTO v_commit;

  INSERT INTO audit_log (feature_id, operation, agent_name, details) VALUES (
    p_feature_id, 'COMMIT_RECORDED', p_committed_by,
    jsonb_build_object('commit_hash', p_commit_hash, 'phase', p_phase::TEXT, 'message', p_message)
  );

  RETURN v_commit;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION record_commit IS 'Record a git commit for a feature';

-- Get commits for a feature
CREATE OR REPLACE FUNCTION get_feature_commits(p_feature_id TEXT)
RETURNS SETOF feature_commits AS $$
  SELECT * FROM feature_commits
  WHERE feature_id = p_feature_id
  ORDER BY committed_at;
$$ LANGUAGE sql SET search_path = public;

COMMENT ON FUNCTION get_feature_commits IS 'Get all commits for a feature';

-- Record PR creation
CREATE OR REPLACE FUNCTION record_pr(
  p_feature_id TEXT,
  p_pr_url TEXT,
  p_pr_number INTEGER
) RETURNS features AS $$
DECLARE
  v_feature features;
BEGIN
  UPDATE features
  SET pr_url = p_pr_url, pr_number = p_pr_number, updated_at = now()
  WHERE id = p_feature_id
  RETURNING * INTO v_feature;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature % not found', p_feature_id;
  END IF;

  INSERT INTO audit_log (feature_id, operation, agent_name, details) VALUES (
    p_feature_id, 'PR_CREATED', 'release-agent',
    jsonb_build_object('pr_url', p_pr_url, 'pr_number', p_pr_number)
  );

  RETURN v_feature;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION record_pr IS 'Record PR creation for a feature';

-- Record merge (called by human, NEVER by agent)
CREATE OR REPLACE FUNCTION record_merge(
  p_feature_id TEXT,
  p_merged_by TEXT DEFAULT 'human'
) RETURNS features AS $$
DECLARE
  v_feature features;
BEGIN
  UPDATE features
  SET merged_at = now(), updated_at = now()
  WHERE id = p_feature_id
  RETURNING * INTO v_feature;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature % not found', p_feature_id;
  END IF;

  INSERT INTO audit_log (feature_id, operation, agent_name, details) VALUES (
    p_feature_id, 'PR_MERGED', p_merged_by,
    jsonb_build_object('merged_at', now()::TEXT, 'pr_url', v_feature.pr_url, 'pr_number', v_feature.pr_number)
  );

  RETURN v_feature;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION record_merge IS 'Record PR merge (called by human, NEVER by agent)';

-- ============================================================================
-- PHASE OUTPUT FUNCTIONS
-- ============================================================================

-- Record phase output (UPSERT)
CREATE OR REPLACE FUNCTION record_phase_output(
  p_feature_id TEXT,
  p_phase phase,
  p_output_type TEXT,
  p_content JSONB,
  p_created_by TEXT DEFAULT 'agent'
) RETURNS phase_outputs
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_output phase_outputs;
BEGIN
  INSERT INTO phase_outputs (feature_id, phase, output_type, content, created_by)
  VALUES (p_feature_id, p_phase, p_output_type, p_content, p_created_by)
  ON CONFLICT (feature_id, phase, output_type)
  DO UPDATE SET
    content = EXCLUDED.content,
    created_by = EXCLUDED.created_by,
    created_at = now()
  RETURNING * INTO v_output;

  RETURN v_output;
END;
$$;

COMMENT ON FUNCTION record_phase_output IS 'Record or update a phase output (requirements, perspectives, tasks)';

-- Get phase outputs for a feature
CREATE OR REPLACE FUNCTION get_phase_outputs(p_feature_id TEXT)
RETURNS SETOF phase_outputs
LANGUAGE sql
SET search_path = public
AS $$
  SELECT * FROM phase_outputs
  WHERE feature_id = p_feature_id
  ORDER BY phase, output_type;
$$;

COMMENT ON FUNCTION get_phase_outputs IS 'Get all phase outputs for a feature';

-- ============================================================================
-- LEARNING FUNCTIONS
-- ============================================================================

-- Evolve a learning (create successor)
CREATE OR REPLACE FUNCTION evolve_learning(
  p_predecessor_id UUID,
  p_title VARCHAR(255),
  p_content TEXT,
  p_delta_summary TEXT,
  p_created_by TEXT
) RETURNS learnings AS $$
DECLARE
  v_predecessor learnings;
  v_new_learning learnings;
  v_new_iteration INTEGER;
BEGIN
  SELECT * INTO v_predecessor FROM learnings WHERE id = p_predecessor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Predecessor learning % not found', p_predecessor_id;
  END IF;

  v_new_iteration := v_predecessor.iteration_number + 1;

  INSERT INTO learnings (
    predecessor_id, iteration_number, feature_id, task_id, category, title, content,
    delta_summary, confidence_score, importance, tags, phase, agent, created_by
  ) VALUES (
    p_predecessor_id, v_new_iteration, v_predecessor.feature_id, v_predecessor.task_id,
    v_predecessor.category, p_title, p_content, p_delta_summary,
    v_predecessor.confidence_score, v_predecessor.importance, v_predecessor.tags,
    v_predecessor.phase, v_predecessor.agent, p_created_by
  )
  RETURNING * INTO v_new_learning;

  -- Mark predecessor as superseded
  UPDATE learnings
  SET is_superseded = true, superseded_by = v_new_learning.id, updated_at = now()
  WHERE id = p_predecessor_id;

  RETURN v_new_learning;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION evolve_learning IS 'Create a new version of a learning (L_n -> L_{n+1})';

-- Validate a learning (increase confidence)
CREATE OR REPLACE FUNCTION validate_learning(
  p_learning_id UUID,
  p_validated_by TEXT
) RETURNS learnings AS $$
DECLARE
  v_learning learnings;
BEGIN
  UPDATE learnings
  SET confidence_score = LEAST(1.00, confidence_score + 0.15),
      validation_count = validation_count + 1,
      last_validated_at = now(),
      validated_by = array_append(COALESCE(validated_by, ARRAY[]::TEXT[]), p_validated_by),
      updated_at = now()
  WHERE id = p_learning_id AND NOT is_superseded
  RETURNING * INTO v_learning;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Learning % not found or is superseded', p_learning_id;
  END IF;

  RETURN v_learning;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION validate_learning IS 'Validate a learning, increasing confidence by 0.15';

-- Record a learning reference (increase confidence by 0.10)
CREATE OR REPLACE FUNCTION record_learning_reference(
  p_learning_id UUID,
  p_referencing_feature_id TEXT
) RETURNS NUMERIC AS $$
DECLARE
  v_new_confidence NUMERIC(3,2);
BEGIN
  UPDATE learnings
  SET confidence_score = LEAST(confidence_score + 0.10, 1.00)
  WHERE id = p_learning_id AND NOT is_superseded
  RETURNING confidence_score INTO v_new_confidence;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Learning not found or superseded';
  END IF;

  RETURN v_new_confidence;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION record_learning_reference IS 'Record a reference to a learning, increasing confidence by 0.10';

-- Get learnings for a feature
CREATE OR REPLACE FUNCTION get_learnings_for_feature(p_feature_id TEXT)
RETURNS TABLE(
  id UUID,
  iteration_number INTEGER,
  category learning_category,
  title VARCHAR(255),
  content TEXT,
  confidence_score NUMERIC,
  is_superseded BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id, l.iteration_number, l.category, l.title, l.content,
    l.confidence_score, l.is_superseded, l.created_at
  FROM learnings l
  WHERE l.feature_id = p_feature_id
  ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

COMMENT ON FUNCTION get_learnings_for_feature IS 'Get all learnings for a feature';

-- Get learning evolution chain
CREATE OR REPLACE FUNCTION get_learning_chain(p_learning_id UUID)
RETURNS TABLE(
  id UUID,
  predecessor_id UUID,
  iteration_number INTEGER,
  title VARCHAR(255),
  confidence_score NUMERIC,
  is_superseded BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE chain AS (
    -- Find root
    SELECT l.id, l.predecessor_id, l.iteration_number, l.title, l.confidence_score, l.is_superseded, l.created_at
    FROM learnings l
    WHERE l.id = p_learning_id

    UNION ALL

    -- Walk up to predecessors
    SELECT l.id, l.predecessor_id, l.iteration_number, l.title, l.confidence_score, l.is_superseded, l.created_at
    FROM learnings l
    JOIN chain c ON l.id = c.predecessor_id

    UNION ALL

    -- Walk down to successors
    SELECT l.id, l.predecessor_id, l.iteration_number, l.title, l.confidence_score, l.is_superseded, l.created_at
    FROM learnings l
    JOIN chain c ON l.predecessor_id = c.id
  )
  SELECT DISTINCT * FROM chain ORDER BY iteration_number;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION get_learning_chain IS 'Get the full evolution chain for a learning';

-- Detect learning conflicts
CREATE OR REPLACE FUNCTION detect_learning_conflicts(p_learning_id UUID)
RETURNS TABLE(
  potential_conflict_id UUID,
  conflict_type learning_conflict_type,
  similarity_reason TEXT
) AS $$
DECLARE
  v_learning RECORD;
BEGIN
  SELECT * INTO v_learning FROM learnings WHERE id = p_learning_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    'SCOPE_OVERLAP'::learning_conflict_type,
    'Same category with overlapping tags or similar title'
  FROM learnings l
  WHERE l.id != p_learning_id
    AND NOT l.is_superseded
    AND l.category = v_learning.category
    AND (
      -- Same tags overlap
      l.tags && v_learning.tags
      OR
      -- Similar title (simple word match)
      ts_rank(
        to_tsvector('english', l.title),
        plainto_tsquery('english', v_learning.title)
      ) > 0.1
    )
    -- Not already in conflict
    AND NOT EXISTS (
      SELECT 1 FROM learning_conflicts c
      WHERE (c.learning_a_id = p_learning_id AND c.learning_b_id = l.id)
         OR (c.learning_a_id = l.id AND c.learning_b_id = p_learning_id)
    );
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

COMMENT ON FUNCTION detect_learning_conflicts IS 'Detect potential conflicts with other learnings';

-- ============================================================================
-- LEARNING PROPAGATION FUNCTIONS
-- ============================================================================

-- Check propagation eligibility
CREATE OR REPLACE FUNCTION check_propagation_eligibility(p_learning_id UUID)
RETURNS TABLE(
  eligible BOOLEAN,
  reason TEXT,
  learning_title TEXT,
  confidence_score NUMERIC
) AS $$
DECLARE
  v_learning learnings%ROWTYPE;
BEGIN
  -- Get the learning
  SELECT * INTO v_learning FROM learnings WHERE id = p_learning_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Learning not found', NULL::text, NULL::numeric;
    RETURN;
  END IF;

  -- Check if superseded
  IF v_learning.is_superseded THEN
    RETURN QUERY SELECT false, 'Learning has been superseded by a newer version',
                        v_learning.title::text, v_learning.confidence_score;
    RETURN;
  END IF;

  -- Check confidence threshold
  IF v_learning.confidence_score < 0.80 THEN
    RETURN QUERY SELECT false,
                        format('Confidence score (%.2f) below threshold (0.80)', v_learning.confidence_score),
                        v_learning.title::text, v_learning.confidence_score;
    RETURN;
  END IF;

  -- Check if already propagated
  IF array_length(v_learning.propagated_to, 1) IS NOT NULL THEN
    RETURN QUERY SELECT false,
                        format('Already propagated to: %s', array_to_string(v_learning.propagated_to, ', ')),
                        v_learning.title::text, v_learning.confidence_score;
    RETURN;
  END IF;

  -- Check for open conflicts
  IF EXISTS (
    SELECT 1 FROM learning_conflicts
    WHERE (learning_a_id = p_learning_id OR learning_b_id = p_learning_id)
    AND status IN ('OPEN', 'INVESTIGATING')
  ) THEN
    RETURN QUERY SELECT false, 'Learning has unresolved conflicts',
                        v_learning.title::text, v_learning.confidence_score;
    RETURN;
  END IF;

  -- Eligible!
  RETURN QUERY SELECT true, 'Eligible for propagation',
                      v_learning.title::text, v_learning.confidence_score;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION check_propagation_eligibility IS 'Check if a learning is eligible for propagation';

-- Format learning for propagation
CREATE OR REPLACE FUNCTION format_learning_for_propagation(p_learning_id UUID)
RETURNS TABLE(
  formatted_markdown TEXT,
  title TEXT,
  category learning_category,
  confidence NUMERIC,
  error_message TEXT
) AS $$
DECLARE
  v_learning RECORD;
  v_feature_name text;
  v_validators text;
  v_formatted text;
  v_eligibility RECORD;
  v_confidence_str text;
BEGIN
  -- Check eligibility first
  SELECT * INTO v_eligibility FROM check_propagation_eligibility(p_learning_id);

  IF NOT v_eligibility.eligible THEN
    RETURN QUERY SELECT NULL::text, v_eligibility.learning_title, NULL::learning_category,
                        v_eligibility.confidence_score, v_eligibility.reason;
    RETURN;
  END IF;

  -- Get full learning details
  SELECT l.*, f.name as feature_name
  INTO v_learning
  FROM learnings l
  LEFT JOIN features f ON l.feature_id = f.id
  WHERE l.id = p_learning_id;

  -- Build validators list
  IF array_length(v_learning.validated_by, 1) > 0 THEN
    v_validators := array_to_string(v_learning.validated_by, ', ');
  ELSE
    v_validators := 'none';
  END IF;

  -- Format confidence as string (avoid format() issues)
  v_confidence_str := to_char(v_learning.confidence_score, '0.00');

  -- Format the markdown using concatenation instead of format() for complex strings
  v_formatted := '### ' || v_learning.category::text || ': ' || v_learning.title || ' (' ||
                 to_char(v_learning.created_at, 'YYYY-MM-DD') || ')' || E'\\n\\n' ||
                 COALESCE(v_learning.propagation_summary,
                          CASE
                            WHEN length(v_learning.content) > 300
                            THEN left(v_learning.content, 300) || '...'
                            ELSE v_learning.content
                          END) || E'\\n\\n' ||
                 '**Confidence**: ' || v_confidence_str ||
                 ' | **Validated by**: ' || v_validators ||
                 ' | **Source**: ' || COALESCE(v_learning.feature_id, 'general');

  RETURN QUERY SELECT v_formatted, v_learning.title::text, v_learning.category,
                      v_learning.confidence_score, NULL::text;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION format_learning_for_propagation IS 'Format a learning as markdown for propagation';

-- Get propagation candidate (full details + eligibility + formatted markdown)
CREATE OR REPLACE FUNCTION get_propagation_candidate(p_learning_id UUID)
RETURNS TABLE(
  id UUID,
  title TEXT,
  category learning_category,
  content TEXT,
  propagation_summary TEXT,
  confidence_score NUMERIC,
  validation_count INTEGER,
  validated_by TEXT[],
  importance learning_importance,
  feature_id TEXT,
  feature_name TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ,
  created_by TEXT,
  formatted_markdown TEXT,
  eligible BOOLEAN,
  eligibility_reason TEXT
) AS $$
DECLARE
  v_formatted RECORD;
  v_eligibility RECORD;
BEGIN
  -- Get eligibility
  SELECT * INTO v_eligibility FROM check_propagation_eligibility(p_learning_id);

  -- Get formatted markdown (will be NULL if not eligible)
  SELECT * INTO v_formatted FROM format_learning_for_propagation(p_learning_id);

  RETURN QUERY
  SELECT
    l.id,
    l.title::text,
    l.category,
    l.content,
    l.propagation_summary,
    l.confidence_score,
    l.validation_count,
    l.validated_by,
    l.importance,
    l.feature_id,
    f.name::text as feature_name,
    l.tags,
    l.created_at,
    l.created_by::text,
    v_formatted.formatted_markdown,
    v_eligibility.eligible,
    v_eligibility.reason
  FROM learnings l
  LEFT JOIN features f ON l.feature_id = f.id
  WHERE l.id = p_learning_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION get_propagation_candidate IS 'Get full propagation candidate details with eligibility';

-- Get propagation history (from audit log)
CREATE OR REPLACE FUNCTION get_propagation_history(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  propagated_at TIMESTAMPTZ,
  learning_id UUID,
  learning_title TEXT,
  destination TEXT,
  propagated_by TEXT,
  confidence_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.timestamp as propagated_at,
    (al.details->>'learning_id')::uuid as learning_id,
    al.details->>'learning_title' as learning_title,
    al.details->>'destination' as destination,
    al.agent_name as propagated_by,
    (al.details->>'confidence_score')::numeric as confidence_score
  FROM audit_log al
  WHERE al.operation = 'LEARNING_PROPAGATED'
  ORDER BY al.timestamp DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION get_propagation_history IS 'Get propagation history from audit log';

-- Mark learning as propagated (legacy, updates JSONB arrays)
CREATE OR REPLACE FUNCTION mark_learning_propagated(
  p_learning_id UUID,
  p_propagated_to TEXT[],
  p_propagation_summary TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE learnings
  SET propagated_to = p_propagated_to,
      propagated_at = now(),
      propagation_summary = p_propagation_summary
  WHERE id = p_learning_id AND NOT is_superseded;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION mark_learning_propagated IS 'Mark learning as propagated (legacy array-based)';

-- Record propagation (legacy, appends to propagated_to array + audit log)
CREATE OR REPLACE FUNCTION record_propagation(
  p_learning_id UUID,
  p_destination TEXT,
  p_propagated_by TEXT,
  p_propagation_summary TEXT DEFAULT NULL
) RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  learning_title TEXT
) AS $$
DECLARE
  v_learning learnings%ROWTYPE;
  v_current_destinations text[];
BEGIN
  -- Get current learning
  SELECT * INTO v_learning FROM learnings WHERE id = p_learning_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Learning not found', NULL::text;
    RETURN;
  END IF;

  -- Get current destinations (or empty array)
  v_current_destinations := COALESCE(v_learning.propagated_to, ARRAY[]::text[]);

  -- Check if already propagated to this destination
  IF p_destination = ANY(v_current_destinations) THEN
    RETURN QUERY SELECT false,
                        format('Already propagated to %s', p_destination),
                        v_learning.title::text;
    RETURN;
  END IF;

  -- Add destination to array
  v_current_destinations := array_append(v_current_destinations, p_destination);

  -- Update the learning
  UPDATE learnings
  SET propagated_to = v_current_destinations,
      propagated_at = now(),
      propagation_summary = COALESCE(p_propagation_summary, learnings.propagation_summary),
      updated_at = now()
  WHERE id = p_learning_id;

  -- Create audit log entry
  INSERT INTO audit_log (operation, agent_name, details)
  VALUES (
    'LEARNING_PROPAGATED',
    p_propagated_by,
    jsonb_build_object(
      'learning_id', p_learning_id,
      'learning_title', v_learning.title,
      'destination', p_destination,
      'confidence_score', v_learning.confidence_score,
      'propagated_at', now()
    )
  );

  RETURN QUERY SELECT true,
                      format('Successfully propagated to %s', p_destination),
                      v_learning.title::text;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION record_propagation IS 'Record propagation to a destination (legacy array-based + audit log)';

-- Declare a propagation target
CREATE OR REPLACE FUNCTION declare_propagation_target(
  p_learning_id UUID,
  p_target_type TEXT,
  p_target_path TEXT DEFAULT NULL,
  p_relevance_score NUMERIC DEFAULT 0.80
) RETURNS learning_propagation_targets AS $$
DECLARE
  v_target learning_propagation_targets;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM learnings WHERE id = p_learning_id) THEN
    RAISE EXCEPTION 'Learning % not found', p_learning_id;
  END IF;

  IF p_relevance_score < 0.60 THEN
    RAISE EXCEPTION 'Relevance score %.2f is below threshold 0.60', p_relevance_score;
  END IF;

  IF p_target_type NOT IN ('agents_md', 'skill', 'agent_definition') THEN
    RAISE EXCEPTION 'Invalid target_type: %. Must be agents_md, skill, or agent_definition', p_target_type;
  END IF;

  INSERT INTO learning_propagation_targets (
    learning_id, target_type, target_path, relevance_score
  ) VALUES (
    p_learning_id, p_target_type, p_target_path, p_relevance_score
  )
  ON CONFLICT DO NOTHING
  RETURNING * INTO v_target;

  IF v_target.id IS NULL THEN
    SELECT * INTO v_target
    FROM learning_propagation_targets
    WHERE learning_id = p_learning_id
      AND target_type = p_target_type
      AND target_path IS NOT DISTINCT FROM p_target_path;
  END IF;

  RETURN v_target;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION declare_propagation_target IS 'Declare a propagation target for a learning (idempotent)';

-- Get skill propagation queue
CREATE OR REPLACE FUNCTION get_skill_propagation_queue()
RETURNS TABLE(
  learning_id UUID,
  title VARCHAR(255),
  category learning_category,
  content TEXT,
  confidence_score NUMERIC,
  feature_id TEXT,
  target_type TEXT,
  target_path TEXT,
  relevance_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.title,
    l.category,
    l.content,
    l.confidence_score,
    l.feature_id,
    lpt.target_type,
    lpt.target_path,
    lpt.relevance_score
  FROM learnings l
  JOIN learning_propagation_targets lpt ON l.id = lpt.learning_id
  LEFT JOIN learning_propagations lp
    ON lpt.learning_id = lp.learning_id
    AND lpt.target_type = lp.target_type
    AND lpt.target_path IS NOT DISTINCT FROM lp.target_path
  WHERE l.confidence_score >= 0.80
    AND NOT l.is_superseded
    AND lpt.relevance_score >= 0.60
    AND lp.id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM learning_conflicts lc
      WHERE (lc.learning_a_id = l.id OR lc.learning_b_id = l.id)
      AND lc.status = 'OPEN'
    )
  ORDER BY l.confidence_score DESC, lpt.relevance_score DESC;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION get_skill_propagation_queue IS 'Get learnings ready for propagation to skills';

-- Record skill propagation
CREATE OR REPLACE FUNCTION record_skill_propagation(
  p_learning_id UUID,
  p_target_type TEXT,
  p_target_path TEXT DEFAULT NULL,
  p_propagated_by TEXT DEFAULT 'orchestrator',
  p_section TEXT DEFAULT NULL
) RETURNS learning_propagations AS $$
DECLARE
  v_propagation learning_propagations;
  v_section TEXT;
BEGIN
  IF p_section IS NOT NULL THEN
    v_section := p_section;
  ELSIF p_target_type = 'agent_definition' THEN
    v_section := 'Learnings';
  ELSE
    v_section := 'Session Learnings';
  END IF;

  INSERT INTO learning_propagations (
    learning_id, target_type, target_path, propagated_by, section
  ) VALUES (
    p_learning_id, p_target_type, p_target_path, p_propagated_by, v_section
  )
  ON CONFLICT DO NOTHING
  RETURNING * INTO v_propagation;

  IF v_propagation.id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO audit_log (feature_id, operation, agent_name, details) VALUES (
    (SELECT feature_id FROM learnings WHERE id = p_learning_id),
    'SKILL_PROPAGATION',
    p_propagated_by,
    jsonb_build_object(
      'learning_id', p_learning_id,
      'target_type', p_target_type,
      'target_path', p_target_path,
      'section', v_section
    )
  );

  RETURN v_propagation;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION record_skill_propagation IS 'Record a completed propagation (idempotent)';

-- Get learning propagation status
CREATE OR REPLACE FUNCTION get_learning_propagation_status(p_learning_id UUID)
RETURNS TABLE(
  target_type TEXT,
  target_path TEXT,
  relevance_score NUMERIC,
  is_propagated BOOLEAN,
  propagated_at TIMESTAMPTZ,
  propagated_by TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lpt.target_type,
    lpt.target_path,
    lpt.relevance_score,
    (lp.id IS NOT NULL)::BOOLEAN,
    lp.propagated_at,
    lp.propagated_by
  FROM learning_propagation_targets lpt
  LEFT JOIN learning_propagations lp
    ON lpt.learning_id = lp.learning_id
    AND lpt.target_type = lp.target_type
    AND lpt.target_path IS NOT DISTINCT FROM lp.target_path
  WHERE lpt.learning_id = p_learning_id
  ORDER BY lpt.relevance_score DESC;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION get_learning_propagation_status IS 'Get propagation status for all targets of a learning';

-- Get propagations for a skill
CREATE OR REPLACE FUNCTION get_propagations_for_skill(p_target_path TEXT)
RETURNS TABLE(
  learning_id UUID,
  title VARCHAR(255),
  category learning_category,
  content TEXT,
  confidence_score NUMERIC,
  propagated_at TIMESTAMPTZ,
  feature_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.title,
    l.category,
    l.content,
    l.confidence_score,
    lp.propagated_at,
    l.feature_id
  FROM learning_propagations lp
  JOIN learnings l ON lp.learning_id = l.id
  WHERE lp.target_path = p_target_path
  ORDER BY lp.propagated_at DESC;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION get_propagations_for_skill IS 'Get all learnings propagated to a specific skill';

-- Get pending evolution syncs
CREATE OR REPLACE FUNCTION get_pending_evolution_syncs()
RETURNS TABLE(
  old_learning_id UUID,
  new_learning_id UUID,
  old_title VARCHAR(255),
  new_title VARCHAR(255),
  new_content TEXT,
  target_type TEXT,
  target_path TEXT,
  propagated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    old_l.id,
    new_l.id,
    old_l.title,
    new_l.title,
    new_l.content,
    lp.target_type,
    lp.target_path,
    lp.propagated_at
  FROM learnings old_l
  JOIN learnings new_l ON old_l.superseded_by = new_l.id
  JOIN learning_propagations lp ON old_l.id = lp.learning_id
  LEFT JOIN learning_propagations new_lp
    ON new_l.id = new_lp.learning_id
    AND lp.target_type = new_lp.target_type
    AND lp.target_path IS NOT DISTINCT FROM new_lp.target_path
  WHERE old_l.is_superseded = true
    AND old_l.superseded_by IS NOT NULL
    AND new_lp.id IS NULL
  ORDER BY lp.propagated_at;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION get_pending_evolution_syncs IS 'Find propagated learnings that have been superseded';

-- ============================================================================
-- EVALS FUNCTIONS
-- ============================================================================

-- Compute feature evaluation (duration-based)
CREATE OR REPLACE FUNCTION compute_feature_eval(p_feature_id TEXT)
RETURNS UUID AS $$
DECLARE
  v_feature RECORD;
  v_duration RECORD;
  v_quality RECORD;
  v_iterations RECORD;
  v_learnings RECORD;
  v_efficiency_score NUMERIC(5,2);
  v_quality_score NUMERIC(5,2);
  v_overall_score NUMERIC(5,2);
  v_health_status eval_health;
  v_eval_id UUID;
  v_expected_duration_minutes INTEGER;
  v_actual_duration_minutes NUMERIC;
  v_duration_source TEXT;
BEGIN
  SELECT * INTO v_feature FROM features WHERE id = p_feature_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature not found: %', p_feature_id;
  END IF;

  -- Expected duration by complexity (in minutes)
  v_expected_duration_minutes := CASE v_feature.complexity_level
    WHEN 1 THEN 60
    WHEN 2 THEN 180
    WHEN 3 THEN 480
    ELSE 180
  END;

  -- Calculate durations
  SELECT
    COALESCE(EXTRACT(EPOCH FROM (
      COALESCE(v_feature.completed_at, now()) - v_feature.created_at
    )) / 60, 0)::INTEGER AS wall_clock_minutes,
    COALESCE(SUM(ai.duration_ms), 0)::BIGINT AS total_agent_ms,
    COUNT(ai.id) AS invocation_count
  INTO v_duration
  FROM agent_invocations ai
  WHERE ai.feature_id = p_feature_id AND ai.ended_at IS NOT NULL;

  IF v_duration.total_agent_ms > 0 THEN
    v_actual_duration_minutes := v_duration.total_agent_ms / 60000.0;
    v_duration_source := 'agent_invocations';
  ELSE
    v_actual_duration_minutes := v_duration.wall_clock_minutes;
    v_duration_source := 'wall_clock';
  END IF;

  -- Quality metrics
  SELECT
    COUNT(*) FILTER (WHERE status = 'APPROVED') AS approvals,
    COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejections,
    COUNT(*) AS total_gates
  INTO v_quality
  FROM quality_gates WHERE feature_id = p_feature_id;

  -- Iteration metrics
  SELECT
    COALESCE(MAX(iteration_number), 0) AS max_iterations,
    COUNT(*) FILTER (WHERE thrashing_detected) AS thrashing_count
  INTO v_iterations
  FROM iteration_tracking WHERE feature_id = p_feature_id;

  -- Learning metrics
  SELECT
    COUNT(*) AS total_learnings,
    COUNT(*) FILTER (WHERE confidence_score >= 0.80) AS high_confidence,
    COUNT(*) FILTER (WHERE array_length(propagated_to, 1) > 0) AS propagated
  INTO v_learnings
  FROM learnings WHERE feature_id = p_feature_id;

  -- Efficiency score (0-100)
  v_efficiency_score := GREATEST(0, LEAST(100,
    CASE
      WHEN v_actual_duration_minutes <= v_expected_duration_minutes THEN 70
      WHEN v_actual_duration_minutes <= v_expected_duration_minutes * 1.5 THEN 55
      WHEN v_actual_duration_minutes <= v_expected_duration_minutes * 2 THEN 35
      ELSE 15
    END +
    CASE
      WHEN v_iterations.max_iterations <= 2 THEN 30
      WHEN v_iterations.max_iterations <= 3 THEN 25
      WHEN v_iterations.max_iterations <= 4 THEN 15
      ELSE 5
    END
  ));

  -- Quality score (0-100)
  v_quality_score := GREATEST(0, LEAST(100,
    CASE
      WHEN v_quality.total_gates = 0 THEN 50
      ELSE (v_quality.approvals::NUMERIC / NULLIF(v_quality.total_gates, 0)) * 50
    END +
    CASE
      WHEN (SELECT COUNT(*) FROM blockers WHERE feature_id = p_feature_id) = 0 THEN 30
      WHEN (SELECT COUNT(*) FROM blockers WHERE feature_id = p_feature_id) = 1 THEN 20
      WHEN (SELECT COUNT(*) FROM blockers WHERE feature_id = p_feature_id) <= 3 THEN 10
      ELSE 0
    END +
    CASE
      WHEN v_iterations.thrashing_count = 0 THEN 20
      ELSE 0
    END
  ));

  -- Overall score
  v_overall_score := (v_efficiency_score * 0.4 + v_quality_score * 0.6);

  -- Health status
  v_health_status := CASE
    WHEN v_overall_score >= 70 THEN 'HEALTHY'
    WHEN v_overall_score >= 50 THEN 'CONCERNING'
    ELSE 'CRITICAL'
  END;

  -- Insert eval
  INSERT INTO feature_evals (
    feature_id, efficiency_score, quality_score, overall_score, health_status,
    efficiency_breakdown, quality_breakdown, learning_metrics, raw_metrics
  ) VALUES (
    p_feature_id,
    v_efficiency_score,
    v_quality_score,
    v_overall_score,
    v_health_status,
    jsonb_build_object(
      'actual_duration_minutes', ROUND(v_actual_duration_minutes, 1),
      'expected_duration_minutes', v_expected_duration_minutes,
      'duration_ratio', ROUND(v_actual_duration_minutes / NULLIF(v_expected_duration_minutes, 0), 2),
      'wall_clock_minutes', v_duration.wall_clock_minutes,
      'total_agent_duration_ms', v_duration.total_agent_ms,
      'agent_invocations', v_duration.invocation_count,
      'iterations', v_iterations.max_iterations,
      'duration_source', v_duration_source
    ),
    jsonb_build_object(
      'approvals', v_quality.approvals,
      'rejections', v_quality.rejections,
      'total_gates', v_quality.total_gates,
      'approval_rate', CASE
        WHEN v_quality.total_gates > 0
        THEN ROUND((v_quality.approvals::NUMERIC / v_quality.total_gates) * 100, 1)
        ELSE 100
      END,
      'thrashing_incidents', v_iterations.thrashing_count,
      'blocker_count', (SELECT COUNT(*) FROM blockers WHERE feature_id = p_feature_id)
    ),
    jsonb_build_object(
      'total_learnings', v_learnings.total_learnings,
      'high_confidence', v_learnings.high_confidence,
      'propagated', v_learnings.propagated
    ),
    jsonb_build_object(
      'computed_at', now(),
      'feature_status', v_feature.status,
      'feature_phase', v_feature.current_phase
    )
  )
  RETURNING id INTO v_eval_id;

  -- Generate alerts
  IF v_overall_score < 50 THEN
    INSERT INTO eval_alerts (severity, dimension, message, current_value, threshold, source_type, source_id, feature_id)
    VALUES ('CRITICAL', 'overall_score', 'Feature health is critical', v_overall_score, 50, 'feature', v_eval_id, p_feature_id);
  ELSIF v_overall_score < 70 THEN
    INSERT INTO eval_alerts (severity, dimension, message, current_value, threshold, source_type, source_id, feature_id)
    VALUES ('WARNING', 'overall_score', 'Feature health is concerning', v_overall_score, 70, 'feature', v_eval_id, p_feature_id);
  END IF;

  IF v_actual_duration_minutes > v_expected_duration_minutes * 2 THEN
    INSERT INTO eval_alerts (severity, dimension, message, current_value, threshold, source_type, source_id, feature_id)
    VALUES ('WARNING', 'duration', 'Feature duration significantly exceeds expectation', v_actual_duration_minutes, v_expected_duration_minutes * 2, 'feature', v_eval_id, p_feature_id);
  END IF;

  IF v_iterations.thrashing_count > 0 THEN
    INSERT INTO eval_alerts (severity, dimension, message, current_value, threshold, source_type, source_id, feature_id)
    VALUES ('WARNING', 'thrashing', 'Spec thrashing detected', v_iterations.thrashing_count, 0, 'feature', v_eval_id, p_feature_id);
  END IF;

  RETURN v_eval_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION compute_feature_eval IS 'Compute duration-based feature evaluation and generate alerts';

-- Compute system health
CREATE OR REPLACE FUNCTION compute_system_health(p_period_days INTEGER DEFAULT 7)
RETURNS UUID AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_workflow RECORD;
  v_duration RECORD;
  v_quality RECORD;
  v_learnings RECORD;
  v_overall_score NUMERIC(5,2);
  v_health_status eval_health;
  v_alerts JSONB := '[]'::jsonb;
  v_eval_id UUID;
BEGIN
  v_period_start := now() - (p_period_days || ' days')::INTERVAL;

  SELECT
    COUNT(*) FILTER (WHERE status = 'COMPLETED' AND completed_at >= v_period_start) AS completed,
    COUNT(*) FILTER (WHERE status = 'BLOCKED') AS blocked,
    COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600)
      FILTER (WHERE status = 'COMPLETED' AND completed_at >= v_period_start) AS avg_cycle_hours
  INTO v_workflow
  FROM features;

  SELECT
    COALESCE(AVG(ai.duration_ms), 0) AS avg_invocation_ms,
    COALESCE(SUM(ai.duration_ms), 0) AS total_duration_ms,
    COUNT(DISTINCT ai.feature_id) AS features_with_invocations
  INTO v_duration
  FROM agent_invocations ai
  WHERE ai.created_at >= v_period_start AND ai.ended_at IS NOT NULL;

  SELECT
    AVG(iteration_number) AS avg_iterations,
    (COUNT(*) FILTER (WHERE thrashing_detected)::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS thrashing_rate
  INTO v_quality
  FROM iteration_tracking
  WHERE recorded_at >= v_period_start;

  SELECT
    COUNT(*) AS total_learnings,
    COUNT(*) FILTER (WHERE confidence_score >= 0.80) AS high_confidence,
    (SELECT COUNT(*) FROM learning_conflicts WHERE status = 'OPEN') AS open_conflicts
  INTO v_learnings
  FROM learnings
  WHERE created_at >= v_period_start;

  v_overall_score := GREATEST(0, LEAST(100,
    CASE
      WHEN COALESCE(v_workflow.completed, 0) > 0 THEN 30
      WHEN COALESCE(v_workflow.in_progress, 0) > 0 THEN 20
      ELSE 15
    END +
    CASE
      WHEN COALESCE(v_quality.avg_iterations, 1) <= 2 THEN 25
      WHEN COALESCE(v_quality.avg_iterations, 1) <= 3 THEN 20
      WHEN COALESCE(v_quality.avg_iterations, 1) <= 4 THEN 10
      ELSE 5
    END +
    CASE
      WHEN COALESCE(v_quality.thrashing_rate, 0) <= 5 THEN 20
      WHEN COALESCE(v_quality.thrashing_rate, 0) <= 15 THEN 10
      ELSE 0
    END +
    CASE
      WHEN v_workflow.in_progress = 0 THEN 25
      WHEN (v_workflow.blocked::NUMERIC / NULLIF(v_workflow.in_progress + v_workflow.blocked, 0)) * 100 <= 10 THEN 25
      WHEN (v_workflow.blocked::NUMERIC / NULLIF(v_workflow.in_progress + v_workflow.blocked, 0)) * 100 <= 25 THEN 15
      ELSE 5
    END
  ));

  v_health_status := CASE
    WHEN v_overall_score >= 70 THEN 'HEALTHY'
    WHEN v_overall_score >= 50 THEN 'CONCERNING'
    ELSE 'CRITICAL'
  END;

  IF v_overall_score < 50 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'severity', 'CRITICAL', 'dimension', 'overall_health',
      'message', 'System health is critical', 'current_value', v_overall_score, 'threshold', 50
    );
  END IF;

  IF COALESCE(v_quality.thrashing_rate, 0) > 15 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'severity', 'CRITICAL', 'dimension', 'thrashing_rate',
      'message', 'High thrashing rate detected', 'current_value', v_quality.thrashing_rate, 'threshold', 15
    );
  END IF;

  IF v_learnings.open_conflicts > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'severity', 'WARNING', 'dimension', 'learning_conflicts',
      'message', 'Open learning conflicts require attention', 'current_value', v_learnings.open_conflicts, 'threshold', 0
    );
  END IF;

  INSERT INTO system_health_evals (
    period_days, overall_health_score, health_status,
    workflow_metrics, quality_metrics, learning_metrics, alerts
  ) VALUES (
    p_period_days,
    v_overall_score,
    v_health_status,
    jsonb_build_object(
      'features_completed', COALESCE(v_workflow.completed, 0),
      'features_blocked', COALESCE(v_workflow.blocked, 0),
      'features_in_progress', COALESCE(v_workflow.in_progress, 0),
      'avg_cycle_time_hours', ROUND(COALESCE(v_workflow.avg_cycle_hours, 0)::NUMERIC, 1)
    ),
    jsonb_build_object(
      'avg_iterations_to_approval', ROUND(COALESCE(v_quality.avg_iterations, 1)::NUMERIC, 1),
      'thrashing_rate', ROUND(COALESCE(v_quality.thrashing_rate, 0)::NUMERIC, 1)
    ),
    jsonb_build_object(
      'total_learnings', COALESCE(v_learnings.total_learnings, 0),
      'high_confidence_learnings', COALESCE(v_learnings.high_confidence, 0),
      'open_conflicts', COALESCE(v_learnings.open_conflicts, 0)
    ),
    v_alerts
  )
  RETURNING id INTO v_eval_id;

  IF v_health_status = 'CRITICAL' THEN
    INSERT INTO eval_alerts (severity, dimension, message, current_value, threshold, source_type, source_id)
    VALUES ('CRITICAL', 'system_health', 'System health is critical', v_overall_score, 50, 'system', v_eval_id);
  END IF;

  RETURN v_eval_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION compute_system_health IS 'Compute system-wide health evaluation';

-- Acknowledge an eval alert
CREATE OR REPLACE FUNCTION acknowledge_alert(
  p_alert_id UUID,
  p_acknowledged_by VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE eval_alerts
  SET acknowledged_at = now(),
      acknowledged_by = p_acknowledged_by
  WHERE id = p_alert_id AND acknowledged_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION acknowledge_alert IS 'Acknowledge an eval alert';

-- Resolve an eval alert
CREATE OR REPLACE FUNCTION resolve_alert(
  p_alert_id UUID,
  p_resolved_by VARCHAR,
  p_resolution_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE eval_alerts
  SET resolved_at = now(),
      resolved_by = p_resolved_by,
      resolution_notes = p_resolution_notes
  WHERE id = p_alert_id AND resolved_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION resolve_alert IS 'Resolve an eval alert';

-- ============================================================================
-- BATCH EXECUTION FUNCTIONS
-- ============================================================================

-- Record batch execution
CREATE OR REPLACE FUNCTION record_batch_execution(
  p_script_name VARCHAR(100),
  p_template_used VARCHAR(100),
  p_total_steps INTEGER,
  p_completed_steps INTEGER,
  p_success BOOLEAN,
  p_failed_step INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL,
  p_feature_id TEXT DEFAULT NULL,
  p_agent_name VARCHAR(100) DEFAULT NULL,
  p_script_json JSONB DEFAULT NULL,
  p_results_json JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_exec_id UUID;
  v_script_hash VARCHAR(64);
BEGIN
  IF p_script_json IS NOT NULL THEN
    v_script_hash := encode(sha256(p_script_json::TEXT::BYTEA), 'hex');
  END IF;

  INSERT INTO batch_executions (
    script_name, script_hash, template_used, total_steps, completed_steps,
    success, failed_step, error_message, duration_ms,
    feature_id, agent_name, script_json, results_json
  ) VALUES (
    p_script_name, v_script_hash, p_template_used, p_total_steps, p_completed_steps,
    p_success, p_failed_step, p_error_message, p_duration_ms,
    p_feature_id, p_agent_name, p_script_json, p_results_json
  )
  RETURNING id INTO v_exec_id;

  IF p_template_used IS NOT NULL THEN
    UPDATE batch_templates
    SET usage_count = usage_count + 1,
        last_used_at = now(),
        avg_duration_ms = CASE
          WHEN avg_duration_ms IS NULL THEN p_duration_ms
          ELSE (avg_duration_ms * (usage_count - 1) + COALESCE(p_duration_ms, 0)) / usage_count
        END,
        success_rate = CASE
          WHEN success_rate IS NULL THEN CASE WHEN p_success THEN 100 ELSE 0 END
          ELSE (success_rate * (usage_count - 1) + CASE WHEN p_success THEN 100 ELSE 0 END) / usage_count
        END
    WHERE name = p_template_used;
  END IF;

  RETURN v_exec_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION record_batch_execution IS 'Record batch execution and update template stats';

-- ============================================================================
-- MEMORY FUNCTIONS
-- ============================================================================

-- Get relevant memories for a feature
CREATE OR REPLACE FUNCTION get_relevant_memories(
  for_feature_id VARCHAR DEFAULT NULL,
  include_global BOOLEAN DEFAULT true,
  max_memories INTEGER DEFAULT 10
) RETURNS TABLE(
  id UUID,
  feature_id VARCHAR(50),
  category memory_category,
  importance memory_importance,
  title VARCHAR(200),
  content TEXT,
  rationale TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.feature_id, m.category, m.importance, m.title, m.content, m.rationale
  FROM memories m
  WHERE m.is_archived = FALSE
    AND ((for_feature_id IS NOT NULL AND m.feature_id = for_feature_id) OR (include_global AND m.feature_id IS NULL))
  ORDER BY m.importance DESC, CASE WHEN m.feature_id = for_feature_id THEN 0 ELSE 1 END, m.created_at DESC
  LIMIT max_memories;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION get_relevant_memories IS 'Get relevant memories for a feature (includes global)';

-- Search memories using full-text search
CREATE OR REPLACE FUNCTION search_memories(
  search_query TEXT,
  category_filter memory_category DEFAULT NULL,
  importance_filter memory_importance DEFAULT NULL,
  feature_filter VARCHAR DEFAULT NULL,
  result_limit INTEGER DEFAULT 20
) RETURNS TABLE(
  id UUID,
  feature_id VARCHAR(50),
  category memory_category,
  importance memory_importance,
  title VARCHAR(200),
  content TEXT,
  rationale TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.feature_id, m.category, m.importance, m.title, m.content, m.rationale, m.tags, m.created_at,
    ts_rank(m.search_vector, websearch_to_tsquery('english', search_query)) as rank
  FROM memories m
  WHERE m.is_archived = FALSE
    AND m.search_vector @@ websearch_to_tsquery('english', search_query)
    AND (category_filter IS NULL OR m.category = category_filter)
    AND (importance_filter IS NULL OR m.importance = importance_filter)
    AND (feature_filter IS NULL OR m.feature_id = feature_filter)
  ORDER BY rank DESC, m.importance DESC, m.created_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION search_memories IS 'Search memories using full-text search with filters';

-- ============================================================================
-- ARCHIVE FUNCTIONS
-- ============================================================================

-- Get feature archive
CREATE OR REPLACE FUNCTION get_feature_archive(p_feature_id VARCHAR)
RETURNS TABLE(
  id UUID,
  feature_id VARCHAR(50),
  storage_path TEXT,
  summary TEXT,
  files_archived TEXT[],
  total_size_bytes INTEGER,
  spec_snapshot JSONB,
  release_version VARCHAR(50),
  release_notes TEXT,
  archived_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY SELECT fa.id, fa.feature_id, fa.storage_path, fa.summary, fa.files_archived,
    fa.total_size_bytes, fa.spec_snapshot, fa.release_version, fa.release_notes, fa.archived_at
  FROM feature_archives fa WHERE fa.feature_id = p_feature_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION get_feature_archive IS 'Get archive for a feature';

-- Search archives using full-text search
CREATE OR REPLACE FUNCTION search_archives(
  search_query TEXT,
  result_limit INTEGER DEFAULT 20
) RETURNS TABLE(
  id UUID,
  feature_id VARCHAR(50),
  summary TEXT,
  release_version VARCHAR(50),
  archived_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY SELECT fa.id, fa.feature_id, fa.summary, fa.release_version, fa.archived_at,
    ts_rank(fa.search_vector, websearch_to_tsquery('english', search_query)) AS rank
  FROM feature_archives fa WHERE fa.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION search_archives IS 'Search feature archives using full-text search';
