-- Migration: 016_release_lifecycle
-- Description: Persist Release handoff and closeout lifecycle metadata on features.
-- Dependencies:
--   - 011_complete_feature_phase_coverage.sql

ALTER TABLE features
  ADD COLUMN IF NOT EXISTS release_handoff_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS release_handoff_by TEXT,
  ADD COLUMN IF NOT EXISTS release_handoff_summary TEXT,
  ADD COLUMN IF NOT EXISTS release_closeout_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS release_closeout_by TEXT,
  ADD COLUMN IF NOT EXISTS release_closeout_summary TEXT;

COMMENT ON COLUMN features.release_handoff_at IS 'Time when Release handoff was recorded after PR creation.';
COMMENT ON COLUMN features.release_handoff_by IS 'Actor that recorded Release handoff.';
COMMENT ON COLUMN features.release_handoff_summary IS 'Summary supplied for Release handoff.';
COMMENT ON COLUMN features.release_closeout_at IS 'Time when Release closeout was recorded after merge.';
COMMENT ON COLUMN features.release_closeout_by IS 'Actor that recorded Release closeout.';
COMMENT ON COLUMN features.release_closeout_summary IS 'Summary supplied for Release closeout.';

DROP FUNCTION IF EXISTS get_feature_status(TEXT);

CREATE OR REPLACE FUNCTION get_feature_status(p_feature_id TEXT)
RETURNS TABLE (
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
  completed_at TIMESTAMPTZ,
  branch_name TEXT,
  base_branch TEXT,
  dev_initials TEXT,
  pr_url TEXT,
  pr_number INTEGER,
  release_handoff_at TIMESTAMPTZ,
  release_handoff_by TEXT,
  release_handoff_summary TEXT,
  merged_at TIMESTAMPTZ,
  release_closeout_at TIMESTAMPTZ,
  release_closeout_by TEXT,
  release_closeout_summary TEXT,
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
    f.completed_at,
    f.branch_name,
    f.base_branch,
    f.dev_initials,
    f.pr_url,
    f.pr_number,
    f.release_handoff_at,
    f.release_handoff_by,
    f.release_handoff_summary,
    f.merged_at,
    f.release_closeout_at,
    f.release_closeout_by,
    f.release_closeout_summary,
    f.author
  FROM features f
  WHERE f.id = p_feature_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION get_feature_status IS 'Get comprehensive feature status including git tracking, release lifecycle metadata, completion timestamp, and metrics';
