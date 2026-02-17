-- ============================================================================
-- Odin SDD Framework - Consolidated Views
-- Version: 1.1.0
-- Created: 2026-02-16
-- Updated: 2026-02-16 (reconciled with live Supabase DB)
-- Description: All database views for Odin. Run after 002_functions.sql.
--   All views use security_invoker = true to prevent SECURITY DEFINER bypasses.
-- ============================================================================

-- ============================================================================
-- FEATURE VIEWS
-- ============================================================================

-- Active features with duration tracking
CREATE OR REPLACE VIEW v_active_features WITH (security_invoker = true) AS
SELECT
  f.id,
  f.name,
  f.complexity_level,
  f.severity,
  f.current_phase,
  f.status,
  f.epic_id,
  f.parent_feature_id,
  f.created_at,
  f.updated_at,
  f.completed_at,
  f.requirements_path,
  f.spec_path,
  f.assigned_agent,
  COUNT(DISTINCT pt.id) AS phase_transition_count,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'OPEN') AS open_blockers,
  COALESCE(SUM(ai.duration_ms) FILTER (WHERE ai.ended_at IS NOT NULL), 0) AS total_duration_ms,
  COUNT(DISTINCT ai.id) AS invocation_count,
  MAX(COALESCE(ai.ended_at, ai.started_at)) AS last_activity
FROM features f
  LEFT JOIN phase_transitions pt ON f.id = pt.feature_id
  LEFT JOIN blockers b ON f.id = b.feature_id
  LEFT JOIN agent_invocations ai ON f.id = ai.feature_id
WHERE f.status = 'IN_PROGRESS'
GROUP BY f.id;

COMMENT ON VIEW v_active_features IS 'Active features with aggregated metrics';

-- All features summary with health scores (matches live DB column names)
CREATE OR REPLACE VIEW all_features_summary WITH (security_invoker = true) AS
SELECT
  f.id AS feature_id,
  f.name AS feature_name,
  f.status AS feature_status,
  f.current_phase,
  f.complexity_level,
  f.severity,
  f.created_at,
  f.completed_at,
  f.branch_name,
  f.pr_url,
  f.pr_number,
  f.merged_at,
  f.author,
  e.computed_at AS last_eval_at,
  e.overall_score,
  e.health_status,
  e.efficiency_score,
  e.quality_score,
  COALESCE(
    (SELECT sum(ai.duration_ms) FROM agent_invocations ai WHERE ai.feature_id = f.id AND ai.ended_at IS NOT NULL),
    0
  )::BIGINT AS total_duration_ms,
  (SELECT count(*) FROM eval_alerts a WHERE a.feature_id = f.id AND a.resolved_at IS NULL) AS active_alerts
FROM features f
LEFT JOIN LATERAL (
  SELECT fe.computed_at, fe.overall_score, fe.health_status, fe.efficiency_score, fe.quality_score
  FROM feature_evals fe
  WHERE fe.feature_id = f.id
  ORDER BY fe.computed_at DESC
  LIMIT 1
) e ON true
ORDER BY
  CASE f.status
    WHEN 'IN_PROGRESS' THEN 0
    WHEN 'BLOCKED' THEN 1
    WHEN 'COMPLETED' THEN 2
    WHEN 'CANCELLED' THEN 3
  END,
  f.created_at DESC;

COMMENT ON VIEW all_features_summary IS 'Summary of all features with latest health scores';

-- Feature health overview (for dashboard)
CREATE OR REPLACE VIEW feature_health_overview WITH (security_invoker = true) AS
SELECT
  f.id AS feature_id,
  f.name AS feature_name,
  f.status AS feature_status,
  f.current_phase,
  f.complexity_level,
  e.computed_at AS last_eval_at,
  e.overall_score,
  e.health_status,
  e.efficiency_score,
  e.quality_score,
  COALESCE((SELECT SUM(ai.duration_ms) FROM agent_invocations ai WHERE ai.feature_id = f.id AND ai.ended_at IS NOT NULL), 0) AS total_duration_ms,
  (SELECT COUNT(*) FROM eval_alerts a WHERE a.feature_id = f.id AND a.resolved_at IS NULL) AS active_alerts
FROM features f
  LEFT JOIN LATERAL (
    SELECT fe.* FROM feature_evals fe
    WHERE fe.feature_id = f.id
    ORDER BY fe.computed_at DESC LIMIT 1
  ) e ON true
WHERE f.status IN ('IN_PROGRESS', 'BLOCKED')
ORDER BY
  CASE
    WHEN e.health_status = 'CRITICAL' THEN 0
    WHEN e.health_status = 'CONCERNING' THEN 1
    ELSE 2
  END,
  f.updated_at DESC;

COMMENT ON VIEW feature_health_overview IS 'Feature health overview prioritized by health status';

-- Pending quality gates
CREATE OR REPLACE VIEW v_pending_gates WITH (security_invoker = true) AS
SELECT
  qg.id,
  qg.feature_id,
  qg.gate_name,
  qg.phase,
  qg.status,
  qg.approver,
  qg.approved_at,
  qg.approval_notes,
  qg.decision_log,
  f.name AS feature_name,
  f.complexity_level,
  f.assigned_agent
FROM quality_gates qg
JOIN features f ON qg.feature_id = f.id
WHERE qg.status = 'PENDING';

COMMENT ON VIEW v_pending_gates IS 'Quality gates awaiting approval';

-- ============================================================================
-- LEARNING VIEWS
-- ============================================================================

-- Active learnings with propagation status (derived from relational tables)
CREATE OR REPLACE VIEW active_learnings WITH (security_invoker = true) AS
SELECT
  l.id,
  l.predecessor_id,
  l.iteration_number,
  l.feature_id,
  f.name AS feature_name,
  l.task_id,
  l.category,
  l.title,
  l.content,
  l.delta_summary,
  l.confidence_score,
  l.validation_count,
  l.last_validated_at,
  l.importance,
  l.tags,
  l.phase,
  l.agent,
  l.created_at,
  l.updated_at,
  l.created_by,
  -- Derive is_propagated from relational tables
  CASE
    WHEN prop_stats.total_targets > 0 AND prop_stats.propagated_count = prop_stats.total_targets THEN true
    ELSE false
  END AS is_propagated,
  -- Keep propagated_to for backward compat
  l.propagated_to,
  l.propagated_at,
  -- Derive ready_for_propagation from relational tables
  CASE
    WHEN l.confidence_score >= 0.80
      AND prop_stats.total_targets > 0
      AND prop_stats.propagated_count < prop_stats.total_targets THEN true
    ELSE false
  END AS ready_for_propagation,
  (EXISTS (
    SELECT 1 FROM learnings s WHERE s.predecessor_id = l.id
  )) AS has_successors,
  -- Propagation status for badges
  COALESCE(prop_stats.propagation_status, 'no_targets') AS propagation_status,
  COALESCE(prop_stats.total_targets, 0) AS total_targets,
  COALESCE(prop_stats.propagated_count, 0) AS propagated_count
FROM learnings l
LEFT JOIN features f ON l.feature_id = f.id
LEFT JOIN LATERAL (
  SELECT
    count(lpt.id)::integer AS total_targets,
    count(lp.id)::integer AS propagated_count,
    CASE
      WHEN count(lpt.id) = 0 THEN 'no_targets'
      WHEN count(lp.id) = count(lpt.id) THEN 'complete'
      WHEN count(lp.id) > 0 THEN 'partial'
      ELSE 'pending'
    END AS propagation_status
  FROM learning_propagation_targets lpt
  LEFT JOIN learning_propagations lp
    ON lpt.learning_id = lp.learning_id
    AND lpt.target_type = lp.target_type
    AND NOT lpt.target_path IS DISTINCT FROM lp.target_path
  WHERE lpt.learning_id = l.id
) prop_stats ON true
WHERE NOT l.is_superseded;

COMMENT ON VIEW active_learnings IS 'Active (non-superseded) learnings with propagation status';

-- Propagation queue (learnings ready for propagation — matches live DB)
CREATE OR REPLACE VIEW propagation_queue WITH (security_invoker = true) AS
SELECT
  l.id,
  l.category,
  l.title,
  l.content,
  l.confidence_score,
  l.validation_count,
  l.importance,
  l.feature_id,
  f.name AS feature_name,
  l.tags,
  l.created_at,
  l.created_by,
  CASE
    WHEN l.propagation_summary IS NOT NULL THEN l.propagation_summary
    ELSE left(l.content, 200) ||
      CASE WHEN length(l.content) > 200 THEN '...' ELSE '' END
  END AS suggested_summary
FROM learnings l
LEFT JOIN features f ON l.feature_id = f.id
WHERE l.confidence_score >= 0.80
  AND array_length(l.propagated_to, 1) IS NULL
  AND NOT l.is_superseded
ORDER BY l.confidence_score DESC, l.importance DESC;

COMMENT ON VIEW propagation_queue IS 'Learnings eligible for propagation (confidence >= 0.80)';

-- Skill propagation queue
CREATE OR REPLACE VIEW skill_propagation_queue WITH (security_invoker = true) AS
SELECT
  l.id AS learning_id,
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
  );

COMMENT ON VIEW skill_propagation_queue IS 'Learnings with unpropagated skill targets';

-- Learning propagation overview
CREATE OR REPLACE VIEW learning_propagation_overview WITH (security_invoker = true) AS
SELECT
  l.id AS learning_id,
  l.title,
  l.category,
  l.confidence_score,
  l.feature_id,
  COUNT(lpt.id)::INTEGER AS total_targets,
  COUNT(lp.id)::INTEGER AS propagated_count,
  (COUNT(lpt.id) - COUNT(lp.id))::INTEGER AS pending_count,
  CASE
    WHEN COUNT(lpt.id) = 0 THEN 'no_targets'
    WHEN COUNT(lp.id) = COUNT(lpt.id) THEN 'complete'
    WHEN COUNT(lp.id) > 0 THEN 'partial'
    ELSE 'pending'
  END AS propagation_status
FROM learnings l
LEFT JOIN learning_propagation_targets lpt ON l.id = lpt.learning_id
LEFT JOIN learning_propagations lp
  ON lpt.learning_id = lp.learning_id
  AND lpt.target_type = lp.target_type
  AND lpt.target_path IS NOT DISTINCT FROM lp.target_path
WHERE NOT l.is_superseded
GROUP BY l.id, l.title, l.category, l.confidence_score, l.feature_id;

COMMENT ON VIEW learning_propagation_overview IS 'Propagation status summary per learning';

-- Open learning conflicts (matches live DB with extra columns)
CREATE OR REPLACE VIEW open_learning_conflicts WITH (security_invoker = true) AS
SELECT
  c.id,
  c.conflict_type,
  c.description,
  c.status,
  c.detected_at,
  c.detected_by,
  c.learning_a_id,
  la.title AS learning_a_title,
  la.category AS learning_a_category,
  la.confidence_score AS learning_a_confidence,
  la.feature_id AS learning_a_feature_id,
  c.learning_b_id,
  lb.title AS learning_b_title,
  lb.category AS learning_b_category,
  lb.confidence_score AS learning_b_confidence,
  lb.feature_id AS learning_b_feature_id,
  EXTRACT(EPOCH FROM (now() - c.detected_at)) / 3600 AS hours_open
FROM learning_conflicts c
JOIN learnings la ON c.learning_a_id = la.id
JOIN learnings lb ON c.learning_b_id = lb.id
WHERE c.status IN ('OPEN', 'INVESTIGATING')
ORDER BY c.detected_at;

COMMENT ON VIEW open_learning_conflicts IS 'Open learning conflicts requiring resolution';

-- Feature learning summary (matches live DB with extra columns)
CREATE OR REPLACE VIEW feature_learning_summary WITH (security_invoker = true) AS
SELECT
  f.id AS feature_id,
  f.name AS feature_name,
  f.status AS feature_status,
  COUNT(l.id) AS total_learnings,
  COUNT(l.id) FILTER (WHERE NOT l.is_superseded) AS active_learnings,
  COUNT(l.id) FILTER (WHERE l.confidence_score >= 0.80) AS high_confidence_learnings,
  COUNT(l.id) FILTER (WHERE array_length(l.propagated_to, 1) > 0) AS propagated_learnings,
  AVG(l.confidence_score) FILTER (WHERE NOT l.is_superseded) AS avg_confidence,
  MAX(l.created_at) AS last_learning_at,
  array_agg(DISTINCT l.category) FILTER (WHERE NOT l.is_superseded) AS categories_covered
FROM features f
LEFT JOIN learnings l ON l.feature_id = f.id
GROUP BY f.id, f.name, f.status;

COMMENT ON VIEW feature_learning_summary IS 'Learning statistics per feature';

-- Learning chain summary (evolution chains)
CREATE OR REPLACE VIEW learning_chain_summary WITH (security_invoker = true) AS
WITH chain_stats AS (
  SELECT
    (WITH RECURSIVE find_root AS (
      SELECT l.id, l.predecessor_id, l.id AS current
      FROM learnings l WHERE l.id = outer_l.id
      UNION ALL
      SELECT fr.id, p.predecessor_id, p.id
      FROM find_root fr JOIN learnings p ON fr.predecessor_id = p.id
    )
    SELECT find_root.current FROM find_root WHERE find_root.predecessor_id IS NULL LIMIT 1
    ) AS chain_root_id,
    outer_l.id,
    outer_l.iteration_number,
    outer_l.is_superseded,
    outer_l.confidence_score,
    outer_l.title,
    outer_l.created_at
  FROM learnings outer_l
)
SELECT
  chain_root_id,
  count(*) AS chain_length,
  max(iteration_number) AS latest_iteration,
  max(confidence_score) FILTER (WHERE NOT is_superseded) AS current_confidence,
  (SELECT learnings.title FROM learnings WHERE learnings.id = chain_stats.chain_root_id) AS original_title,
  (SELECT cs2.id FROM chain_stats cs2
   WHERE cs2.chain_root_id = chain_stats.chain_root_id AND NOT cs2.is_superseded
   ORDER BY cs2.iteration_number DESC LIMIT 1) AS current_learning_id,
  min(created_at) AS chain_started_at,
  max(created_at) AS last_evolved_at
FROM chain_stats
WHERE chain_root_id IS NOT NULL
GROUP BY chain_root_id;

COMMENT ON VIEW learning_chain_summary IS 'Summary of learning evolution chains';

-- ============================================================================
-- EVALS VIEWS
-- ============================================================================

-- Active eval alerts (matches live DB with extra columns)
CREATE OR REPLACE VIEW active_eval_alerts WITH (security_invoker = true) AS
SELECT
  a.id,
  a.severity,
  a.dimension,
  a.message,
  a.current_value,
  a.threshold,
  a.source_type,
  a.feature_id,
  f.name AS feature_name,
  a.created_at,
  EXTRACT(EPOCH FROM (now() - a.created_at)) / 3600 AS hours_active,
  (a.acknowledged_at IS NOT NULL) AS is_acknowledged,
  a.acknowledged_by
FROM eval_alerts a
LEFT JOIN features f ON a.feature_id = f.id
WHERE a.resolved_at IS NULL
ORDER BY
  CASE a.severity WHEN 'CRITICAL' THEN 0 ELSE 1 END,
  a.created_at DESC;

COMMENT ON VIEW active_eval_alerts IS 'Unresolved evaluation alerts';

-- Latest system health per period
CREATE OR REPLACE VIEW latest_system_health WITH (security_invoker = true) AS
SELECT DISTINCT ON (period_days)
  id,
  computed_at,
  period_days,
  overall_health_score,
  health_status,
  workflow_metrics,
  quality_metrics,
  learning_metrics,
  alerts
FROM system_health_evals
ORDER BY period_days, computed_at DESC;

COMMENT ON VIEW latest_system_health IS 'Most recent system health eval per time period';

-- ============================================================================
-- BATCH EXECUTION VIEWS
-- ============================================================================

-- Batch execution stats (last 30 days)
CREATE OR REPLACE VIEW batch_execution_stats WITH (security_invoker = true) AS
SELECT
  COALESCE(template_used, 'custom') AS template,
  COUNT(*) AS total_executions,
  COUNT(*) FILTER (WHERE success) AS successful,
  COUNT(*) FILTER (WHERE NOT success) AS failed,
  ROUND(AVG(duration_ms), 0) AS avg_duration_ms,
  MAX(executed_at) AS last_execution
FROM batch_executions
WHERE executed_at >= now() - INTERVAL '30 days'
GROUP BY COALESCE(template_used, 'custom')
ORDER BY COUNT(*) DESC;

COMMENT ON VIEW batch_execution_stats IS 'Batch execution statistics by template (30 day window)';

-- ============================================================================
-- MEMORY VIEWS
-- ============================================================================

-- Recent memories (last 30 days)
CREATE OR REPLACE VIEW v_recent_memories WITH (security_invoker = true) AS
SELECT id, feature_id, category, importance, title, content, rationale, tags, phase, agent, created_at, created_by
FROM memories
WHERE is_archived = false AND created_at > now() - INTERVAL '30 days'
ORDER BY created_at DESC;

COMMENT ON VIEW v_recent_memories IS 'Memories created in the last 30 days';

-- Critical memories (HIGH importance)
CREATE OR REPLACE VIEW v_critical_memories WITH (security_invoker = true) AS
SELECT id, feature_id, category, importance, title, content, rationale, tags, phase, agent, created_at, created_by
FROM memories
WHERE is_archived = false AND importance = 'HIGH'
ORDER BY created_at DESC;

COMMENT ON VIEW v_critical_memories IS 'High-importance memories';

-- Global memories (not tied to a feature)
CREATE OR REPLACE VIEW v_global_memories WITH (security_invoker = true) AS
SELECT id, category, importance, title, content, rationale, tags, phase, agent, created_at, created_by
FROM memories
WHERE is_archived = false AND feature_id IS NULL
ORDER BY importance DESC, created_at DESC;

COMMENT ON VIEW v_global_memories IS 'Global memories not tied to any feature';

-- Gotchas
CREATE OR REPLACE VIEW v_gotchas WITH (security_invoker = true) AS
SELECT id, feature_id, importance, title, content, rationale, tags, created_at
FROM memories
WHERE is_archived = false AND category = 'GOTCHA'
ORDER BY importance DESC, created_at DESC;

COMMENT ON VIEW v_gotchas IS 'All gotcha memories';

-- Architecture timeline
CREATE OR REPLACE VIEW v_architecture_timeline WITH (security_invoker = true) AS
SELECT id, feature_id, category, importance, title, content, rationale, tags, created_at, created_by
FROM memories
WHERE is_archived = false AND category IN ('ARCHITECTURE', 'DECISION')
ORDER BY created_at DESC;

COMMENT ON VIEW v_architecture_timeline IS 'Architecture decisions and patterns timeline';

-- Feature memory stats
CREATE OR REPLACE VIEW v_feature_memory_stats WITH (security_invoker = true) AS
SELECT
  feature_id,
  count(*) AS total_memories,
  count(*) FILTER (WHERE importance = 'HIGH') AS high_importance,
  count(*) FILTER (WHERE category = 'DECISION') AS decisions,
  count(*) FILTER (WHERE category = 'GOTCHA') AS gotchas,
  count(*) FILTER (WHERE category = 'PATTERN') AS patterns,
  count(*) FILTER (WHERE category = 'ARCHITECTURE') AS architecture,
  count(*) FILTER (WHERE category = 'BLOCKER') AS blockers,
  max(created_at) AS last_memory_at
FROM memories
WHERE is_archived = false AND feature_id IS NOT NULL
GROUP BY feature_id;

COMMENT ON VIEW v_feature_memory_stats IS 'Memory statistics per feature';

-- ============================================================================
-- ARCHIVE VIEWS
-- ============================================================================

-- Recent archives
CREATE OR REPLACE VIEW v_recent_archives WITH (security_invoker = true) AS
SELECT
  fa.id,
  fa.feature_id,
  f.name AS feature_name,
  fa.summary,
  fa.files_archived,
  fa.total_size_bytes,
  fa.release_version,
  fa.archived_at,
  fa.spec_snapshot->>'complexity_level' AS complexity_level,
  array_length(fa.files_archived, 1) AS file_count
FROM feature_archives fa
JOIN features f ON f.id = fa.feature_id::text
ORDER BY fa.archived_at DESC
LIMIT 50;

COMMENT ON VIEW v_recent_archives IS 'Most recent 50 feature archives';

-- Archive stats
CREATE OR REPLACE VIEW v_archive_stats WITH (security_invoker = true) AS
SELECT
  count(*) AS total_archives,
  sum(total_size_bytes) AS total_storage_bytes,
  sum(array_length(files_archived, 1)) AS total_files,
  count(DISTINCT release_version) AS release_count,
  min(archived_at) AS oldest_archive,
  max(archived_at) AS newest_archive
FROM feature_archives;

COMMENT ON VIEW v_archive_stats IS 'Aggregate archive statistics';

-- Archives by release
CREATE OR REPLACE VIEW v_archives_by_release WITH (security_invoker = true) AS
SELECT
  release_version,
  count(*) AS feature_count,
  sum(total_size_bytes) AS total_bytes,
  array_agg(feature_id ORDER BY archived_at) AS features,
  min(archived_at) AS release_date
FROM feature_archives
WHERE release_version IS NOT NULL
GROUP BY release_version
ORDER BY min(archived_at) DESC;

COMMENT ON VIEW v_archives_by_release IS 'Archives grouped by release version';

-- ============================================================================
-- CONFLICT VIEWS
-- ============================================================================

-- High risk conflicts
CREATE OR REPLACE VIEW v_high_risk_conflicts WITH (security_invoker = true) AS
SELECT
  cd.id,
  cd.feature_a_id,
  cd.feature_b_id,
  cd.file_path,
  cd.conflict_risk,
  cd.detected_at,
  cd.detected_phase,
  cd.status,
  cd.strategy,
  cd.notes,
  fa.name AS feature_a_name,
  fb.name AS feature_b_name,
  fa.assigned_agent AS agent_a,
  fb.assigned_agent AS agent_b
FROM conflict_detection cd
JOIN features fa ON cd.feature_a_id = fa.id
JOIN features fb ON cd.feature_b_id = fb.id
WHERE cd.conflict_risk IN ('HIGH', 'MEDIUM')
  AND cd.status = 'DETECTED';

COMMENT ON VIEW v_high_risk_conflicts IS 'Unresolved high/medium risk conflicts between features';
