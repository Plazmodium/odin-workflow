-- Migration: 011_complete_feature_phase_coverage
-- Description: Align complete_feature() telemetry coverage with phase-based invocation semantics.
-- Dependencies:
--   - 007_odin_v2_phase_alignment.sql
-- Rollback:
--   Re-apply the previous complete_feature() definition if actor-name-pair coverage is required.

CREATE OR REPLACE FUNCTION complete_feature(p_feature_id TEXT, p_completed_by TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_missing_pairs TEXT;
BEGIN
  WITH expected AS (
    SELECT *
    FROM (VALUES
      ('1'::phase),
      ('2'::phase),
      ('3'::phase),
      ('4'::phase),
      ('5'::phase),
      ('6'::phase),
      ('7'::phase),
      ('8'::phase),
      ('9'::phase)
    ) AS t(phase)
  ),
  actual AS (
    SELECT DISTINCT phase
    FROM agent_invocations
    WHERE feature_id = p_feature_id
      AND ended_at IS NOT NULL
      AND duration_ms IS NOT NULL
  ),
  missing AS (
    SELECT e.phase
    FROM expected e
    LEFT JOIN actual a
      ON a.phase = e.phase
    WHERE a.phase IS NULL
  )
  SELECT string_agg(
    format('phase %s', m.phase::TEXT),
    ', '
    ORDER BY m.phase::TEXT
  )
  INTO v_missing_pairs
  FROM missing m;

  IF v_missing_pairs IS NOT NULL THEN
    INSERT INTO quality_gates (
      feature_id, gate_name, phase, status, approver, approval_notes, decision_log
    ) VALUES (
      p_feature_id,
      'agent_invocation_coverage',
      '9',
      'REJECTED',
      p_completed_by,
      'Missing completed agent invocation telemetry: ' || v_missing_pairs,
      'Completion blocked by telemetry coverage guardrail'
    )
    ON CONFLICT (feature_id, gate_name, phase)
    DO UPDATE SET
      status = EXCLUDED.status,
      approver = EXCLUDED.approver,
      approved_at = now(),
      approval_notes = EXCLUDED.approval_notes,
      decision_log = EXCLUDED.decision_log;

    IF NOT EXISTS (
      SELECT 1
      FROM blockers
      WHERE feature_id = p_feature_id
        AND phase = '9'
        AND blocker_type = 'VALIDATION_FAILED'
        AND title = 'Agent invocation telemetry coverage failed'
        AND status IN ('OPEN', 'IN_PROGRESS')
    ) THEN
      INSERT INTO blockers (
        feature_id, blocker_type, phase, status, severity, title, description, created_by
      ) VALUES (
        p_feature_id,
        'VALIDATION_FAILED',
        '9',
        'OPEN',
        'HIGH',
        'Agent invocation telemetry coverage failed',
        'Missing completed agent invocation telemetry: ' || v_missing_pairs,
        p_completed_by
      );
    ELSE
      UPDATE blockers
      SET status = 'OPEN',
          severity = 'HIGH',
          description = 'Missing completed agent invocation telemetry: ' || v_missing_pairs,
          escalation_notes = 'Coverage guardrail re-checked and still failing'
      WHERE feature_id = p_feature_id
        AND phase = '9'
        AND blocker_type = 'VALIDATION_FAILED'
        AND title = 'Agent invocation telemetry coverage failed'
        AND status IN ('OPEN', 'IN_PROGRESS');
    END IF;

    UPDATE features
    SET status = 'BLOCKED',
        updated_at = now()
    WHERE id = p_feature_id
      AND status <> 'COMPLETED';

    INSERT INTO audit_log (feature_id, operation, agent_name, details) VALUES (
      p_feature_id,
      'AGENT_INVOCATION_COVERAGE_FAILED',
      p_completed_by,
      jsonb_build_object(
        'missing_pairs', v_missing_pairs,
        'checkpoint', 'complete_feature'
      )
    );

    RAISE NOTICE 'Cannot complete feature % - missing telemetry coverage: %', p_feature_id, v_missing_pairs;
    RETURN FALSE;
  END IF;

  IF EXISTS (SELECT 1 FROM blockers WHERE feature_id = p_feature_id AND status = 'OPEN') THEN
    RAISE EXCEPTION 'Cannot complete feature % - has open blockers', p_feature_id;
  END IF;

  UPDATE features
  SET status = 'COMPLETED',
      current_phase = '10',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_feature_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature % not found', p_feature_id;
  END IF;

  INSERT INTO phase_transitions (feature_id, from_phase, to_phase, transitioned_by, notes, transition_type)
  VALUES (p_feature_id, '9', '10', p_completed_by, 'Feature completed', 'FORWARD');

  PERFORM compute_feature_eval(p_feature_id);

  INSERT INTO audit_log (feature_id, operation, agent_name, details) VALUES (
    p_feature_id, 'FEATURE_COMPLETED', p_completed_by,
    jsonb_build_object('completed_at', now())
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION complete_feature IS 'Mark feature as completed, transition to phase 10, compute eval, and enforce v2 telemetry coverage for phases 1-9 regardless of custom actor naming. Returns FALSE if telemetry coverage guardrail fails.';

-- Older installs may have an earlier row type for get_feature_status(TEXT), so replace it explicitly.
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
    f.completed_at,
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

COMMENT ON FUNCTION get_feature_status IS 'Get comprehensive feature status including git tracking, completion timestamp, and metrics';
