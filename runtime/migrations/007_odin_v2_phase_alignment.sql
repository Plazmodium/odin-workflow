-- ============================================================================
-- Odin v2 Phase Alignment
-- Version: 2.0.0
-- Created: 2026-03-09
-- Description: Aligns persisted phase numbers with the Odin v2 workflow by:
--   - remapping historical phase values from the 9-phase model to the 11-phase model
--   - updating core workflow functions to use Product/Reviewer numbering
--   - moving Complete from phase 8 to phase 10
--
-- Dependencies: Requires 005_odin_v2_schema.sql and 006_odin_v2_functions.sql
--
-- IMPORTANT: DO NOT RUN ON SUPABASE UNTIL READY FOR DEPLOYMENT
-- ============================================================================

-- ============================================================================
-- PRECHECK
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM audit_log
    WHERE operation = 'MIGRATION_007_PHASE_ALIGNMENT_APPLIED'
  ) THEN
    RAISE EXCEPTION '007_odin_v2_phase_alignment.sql has already been applied';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'phase' AND e.enumlabel = '10'
  ) THEN
    RAISE EXCEPTION 'phase enum is not v2-ready. Run 005_odin_v2_schema.sql before 007_odin_v2_phase_alignment.sql';
  END IF;

  IF to_regclass('public.agent_claims') IS NULL OR to_regclass('public.security_findings') IS NULL THEN
    RAISE EXCEPTION 'v2 tables are missing. Run 005_odin_v2_schema.sql before 007_odin_v2_phase_alignment.sql';
  END IF;

  IF EXISTS (SELECT 1 FROM agent_claims)
     OR EXISTS (SELECT 1 FROM policy_verdicts)
     OR EXISTS (SELECT 1 FROM watcher_reviews)
     OR EXISTS (SELECT 1 FROM security_findings) THEN
    RAISE EXCEPTION '007_odin_v2_phase_alignment.sql must run before any v2 claim/watcher/security data is created';
  END IF;
END;
$$;

-- ============================================================================
-- PHASE REMAP
-- Old numbering: 0=Planning, 1=Discovery, 2=Architect, 3=Guardian, 4=Builder,
--                5=Integrator, 6=Documenter, 7=Release, 8=Complete
-- New numbering: 0=Planning, 1=Product, 2=Discovery, 3=Architect, 4=Guardian,
--                5=Builder, 6=Reviewer, 7=Integrator, 8=Documenter,
--                9=Release, 10=Complete
--
-- Mapping: 0->0, 1->2, 2->3, 3->4, 4->5, 5->7, 6->8, 7->9, 8->10
-- ============================================================================

UPDATE features
SET current_phase = CASE current_phase
  WHEN '0' THEN '0'::phase
  WHEN '1' THEN '2'::phase
  WHEN '2' THEN '3'::phase
  WHEN '3' THEN '4'::phase
  WHEN '4' THEN '5'::phase
  WHEN '5' THEN '7'::phase
  WHEN '6' THEN '8'::phase
  WHEN '7' THEN '9'::phase
  WHEN '8' THEN '10'::phase
END
WHERE current_phase IN ('0', '1', '2', '3', '4', '5', '6', '7', '8');

UPDATE phase_transitions
SET from_phase = CASE from_phase
  WHEN '0' THEN '0'::phase
  WHEN '1' THEN '2'::phase
  WHEN '2' THEN '3'::phase
  WHEN '3' THEN '4'::phase
  WHEN '4' THEN '5'::phase
  WHEN '5' THEN '7'::phase
  WHEN '6' THEN '8'::phase
  WHEN '7' THEN '9'::phase
  WHEN '8' THEN '10'::phase
END
WHERE from_phase IN ('0', '1', '2', '3', '4', '5', '6', '7', '8');

UPDATE phase_transitions
SET to_phase = CASE to_phase
  WHEN '0' THEN '0'::phase
  WHEN '1' THEN '2'::phase
  WHEN '2' THEN '3'::phase
  WHEN '3' THEN '4'::phase
  WHEN '4' THEN '5'::phase
  WHEN '5' THEN '7'::phase
  WHEN '6' THEN '8'::phase
  WHEN '7' THEN '9'::phase
  WHEN '8' THEN '10'::phase
END
WHERE to_phase IN ('0', '1', '2', '3', '4', '5', '6', '7', '8');

UPDATE quality_gates
SET phase = CASE phase
  WHEN '0' THEN '0'::phase
  WHEN '1' THEN '2'::phase
  WHEN '2' THEN '3'::phase
  WHEN '3' THEN '4'::phase
  WHEN '4' THEN '5'::phase
  WHEN '5' THEN '7'::phase
  WHEN '6' THEN '8'::phase
  WHEN '7' THEN '9'::phase
  WHEN '8' THEN '10'::phase
END
WHERE phase IN ('0', '1', '2', '3', '4', '5', '6', '7', '8');

UPDATE blockers
SET phase = CASE phase
  WHEN '0' THEN '0'::phase
  WHEN '1' THEN '2'::phase
  WHEN '2' THEN '3'::phase
  WHEN '3' THEN '4'::phase
  WHEN '4' THEN '5'::phase
  WHEN '5' THEN '7'::phase
  WHEN '6' THEN '8'::phase
  WHEN '7' THEN '9'::phase
  WHEN '8' THEN '10'::phase
END
WHERE phase IN ('0', '1', '2', '3', '4', '5', '6', '7', '8');

UPDATE conflict_detection
SET detected_phase = CASE detected_phase
  WHEN '0' THEN '0'::phase
  WHEN '1' THEN '2'::phase
  WHEN '2' THEN '3'::phase
  WHEN '3' THEN '4'::phase
  WHEN '4' THEN '5'::phase
  WHEN '5' THEN '7'::phase
  WHEN '6' THEN '8'::phase
  WHEN '7' THEN '9'::phase
  WHEN '8' THEN '10'::phase
END
WHERE detected_phase IN ('0', '1', '2', '3', '4', '5', '6', '7', '8');

UPDATE agent_invocations
SET phase = CASE phase
  WHEN '0' THEN '0'::phase
  WHEN '1' THEN '2'::phase
  WHEN '2' THEN '3'::phase
  WHEN '3' THEN '4'::phase
  WHEN '4' THEN '5'::phase
  WHEN '5' THEN '7'::phase
  WHEN '6' THEN '8'::phase
  WHEN '7' THEN '9'::phase
  WHEN '8' THEN '10'::phase
END
WHERE phase IN ('0', '1', '2', '3', '4', '5', '6', '7', '8');

UPDATE feature_commits
SET phase = CASE phase
  WHEN '0' THEN '0'::phase
  WHEN '1' THEN '2'::phase
  WHEN '2' THEN '3'::phase
  WHEN '3' THEN '4'::phase
  WHEN '4' THEN '5'::phase
  WHEN '5' THEN '7'::phase
  WHEN '6' THEN '8'::phase
  WHEN '7' THEN '9'::phase
  WHEN '8' THEN '10'::phase
END
WHERE phase IN ('0', '1', '2', '3', '4', '5', '6', '7', '8');

UPDATE phase_outputs
SET phase = CASE phase
  WHEN '0' THEN '0'::phase
  WHEN '1' THEN '2'::phase
  WHEN '2' THEN '3'::phase
  WHEN '3' THEN '4'::phase
  WHEN '4' THEN '5'::phase
  WHEN '5' THEN '7'::phase
  WHEN '6' THEN '8'::phase
  WHEN '7' THEN '9'::phase
  WHEN '8' THEN '10'::phase
END
WHERE phase IN ('0', '1', '2', '3', '4', '5', '6', '7', '8');

UPDATE memories
SET phase = CASE phase
  WHEN '0' THEN '0'::phase
  WHEN '1' THEN '2'::phase
  WHEN '2' THEN '3'::phase
  WHEN '3' THEN '4'::phase
  WHEN '4' THEN '5'::phase
  WHEN '5' THEN '7'::phase
  WHEN '6' THEN '8'::phase
  WHEN '7' THEN '9'::phase
  WHEN '8' THEN '10'::phase
  ELSE NULL
END
WHERE phase IS NOT NULL;

UPDATE learnings
SET phase = CASE phase
  WHEN '0' THEN '0'::phase
  WHEN '1' THEN '2'::phase
  WHEN '2' THEN '3'::phase
  WHEN '3' THEN '4'::phase
  WHEN '4' THEN '5'::phase
  WHEN '5' THEN '7'::phase
  WHEN '6' THEN '8'::phase
  WHEN '7' THEN '9'::phase
  WHEN '8' THEN '10'::phase
  ELSE NULL
END
WHERE phase IS NOT NULL;

UPDATE agent_claims
SET phase = CASE phase
  WHEN '0' THEN '0'::phase
  WHEN '1' THEN '2'::phase
  WHEN '2' THEN '3'::phase
  WHEN '3' THEN '4'::phase
  WHEN '4' THEN '5'::phase
  WHEN '5' THEN '7'::phase
  WHEN '6' THEN '8'::phase
  WHEN '7' THEN '9'::phase
  WHEN '8' THEN '10'::phase
END
WHERE phase IN ('0', '1', '2', '3', '4', '5', '6', '7', '8');

UPDATE security_findings
SET phase = CASE phase
  WHEN '0' THEN '0'::phase
  WHEN '1' THEN '2'::phase
  WHEN '2' THEN '3'::phase
  WHEN '3' THEN '4'::phase
  WHEN '4' THEN '5'::phase
  WHEN '5' THEN '7'::phase
  WHEN '6' THEN '8'::phase
  WHEN '7' THEN '9'::phase
  WHEN '8' THEN '10'::phase
END
WHERE phase IN ('0', '1', '2', '3', '4', '5', '6', '7', '8');

-- ============================================================================
-- CORE FUNCTION OVERRIDES FOR V2 PHASE NUMBERING
-- ============================================================================

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
  SELECT current_phase INTO v_current_phase FROM features WHERE id = p_feature_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature % not found', p_feature_id;
  END IF;

  v_current_int := v_current_phase::TEXT::INTEGER;
  v_to_int := p_to_phase::TEXT::INTEGER;

  IF v_to_int = v_current_int THEN
    v_transition_type := 'FORWARD';
  ELSIF v_to_int = v_current_int + 1 THEN
    v_transition_type := 'FORWARD';
  ELSIF v_to_int > v_current_int + 1 THEN
    RAISE EXCEPTION 'Phase skip not allowed: cannot jump from phase % to phase %. '
      'Phases must advance sequentially (one at a time). '
      'Current: % (%), Target: % (%). '
      'All 11 phases must be executed - complexity level affects depth within each phase, not which phases run.',
      v_current_int, v_to_int,
      v_current_int,
      CASE v_current_int
        WHEN 0 THEN 'Planning'
        WHEN 1 THEN 'Product'
        WHEN 2 THEN 'Discovery'
        WHEN 3 THEN 'Architect'
        WHEN 4 THEN 'Guardian'
        WHEN 5 THEN 'Builder'
        WHEN 6 THEN 'Reviewer'
        WHEN 7 THEN 'Integrator'
        WHEN 8 THEN 'Documenter'
        WHEN 9 THEN 'Release'
        ELSE 'Complete'
      END,
      v_to_int,
      CASE v_to_int
        WHEN 0 THEN 'Planning'
        WHEN 1 THEN 'Product'
        WHEN 2 THEN 'Discovery'
        WHEN 3 THEN 'Architect'
        WHEN 4 THEN 'Guardian'
        WHEN 5 THEN 'Builder'
        WHEN 6 THEN 'Reviewer'
        WHEN 7 THEN 'Integrator'
        WHEN 8 THEN 'Documenter'
        WHEN 9 THEN 'Release'
        ELSE 'Complete'
      END;
  ELSIF v_to_int < v_current_int THEN
    v_transition_type := 'BACKWARD';
  END IF;

  UPDATE features
  SET current_phase = p_to_phase, updated_at = now()
  WHERE id = p_feature_id;

  INSERT INTO phase_transitions (feature_id, from_phase, to_phase, transitioned_by, transition_type, notes)
  VALUES (p_feature_id, v_current_phase, p_to_phase, p_transitioned_by, v_transition_type, p_notes)
  RETURNING * INTO v_transition;

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

COMMENT ON FUNCTION transition_phase IS 'Transition feature to a new phase with sequential enforcement for the v2 11-phase workflow. Forward transitions must advance exactly one phase at a time. Back transitions (rework) can go to any earlier phase.';

CREATE OR REPLACE FUNCTION complete_feature(p_feature_id TEXT, p_completed_by TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_missing_pairs TEXT;
BEGIN
  WITH expected AS (
    SELECT *
    FROM (VALUES
      ('1'::phase, 'product-agent'::text),
      ('2'::phase, 'discovery-agent'::text),
      ('3'::phase, 'architect-agent'::text),
      ('4'::phase, 'guardian-agent'::text),
      ('5'::phase, 'builder-agent'::text),
      ('6'::phase, 'reviewer-agent'::text),
      ('7'::phase, 'integrator-agent'::text),
      ('8'::phase, 'documenter-agent'::text),
      ('9'::phase, 'release-agent'::text)
    ) AS t(phase, agent_name)
  ),
  actual AS (
    SELECT DISTINCT phase, agent_name
    FROM agent_invocations
    WHERE feature_id = p_feature_id
      AND ended_at IS NOT NULL
      AND duration_ms IS NOT NULL
  ),
  missing AS (
    SELECT e.phase, e.agent_name
    FROM expected e
    LEFT JOIN actual a
      ON a.phase = e.phase
     AND a.agent_name = e.agent_name
    WHERE a.phase IS NULL
  )
  SELECT string_agg(
    format('phase %s -> %s', m.phase::TEXT, m.agent_name),
    ', '
    ORDER BY m.phase::TEXT, m.agent_name
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

COMMENT ON FUNCTION complete_feature IS 'Mark feature as completed, transition to phase 10, compute eval, and enforce v2 telemetry coverage for phases 1-9. Returns FALSE if telemetry coverage guardrail fails.';

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
      pt.id,
      pt.to_phase,
      pt.transitioned_at AS phase_started,
      LEAD(pt.transitioned_at) OVER (ORDER BY pt.transitioned_at, pt.id) AS phase_ended
    FROM phase_transitions pt
    WHERE pt.feature_id = p_feature_id
    ORDER BY pt.transitioned_at, pt.id
  )
  SELECT
    pw.to_phase,
    CASE pw.to_phase
      WHEN '0' THEN 'Planning'
      WHEN '1' THEN 'Product'
      WHEN '2' THEN 'Discovery'
      WHEN '3' THEN 'Architect'
      WHEN '4' THEN 'Guardian'
      WHEN '5' THEN 'Builder'
      WHEN '6' THEN 'Reviewer'
      WHEN '7' THEN 'Integrator'
      WHEN '8' THEN 'Documenter'
      WHEN '9' THEN 'Release'
      WHEN '10' THEN 'Complete'
      ELSE 'Unknown'
    END,
    pw.phase_started,
    CASE WHEN pw.to_phase = '10' THEN pw.phase_started ELSE pw.phase_ended END,
    ROUND(EXTRACT(EPOCH FROM (
      COALESCE(CASE WHEN pw.to_phase = '10' THEN pw.phase_started ELSE pw.phase_ended END, now()) - pw.phase_started
    )) / 60, 1),
    COALESCE((
      SELECT COUNT(*) FROM agent_invocations ai
      WHERE ai.feature_id = p_feature_id AND ai.phase = pw.to_phase
    ), 0),
    COALESCE((
      SELECT SUM(ai.duration_ms) FROM agent_invocations ai
      WHERE ai.feature_id = p_feature_id AND ai.phase = pw.to_phase AND ai.ended_at IS NOT NULL
    ), 0)::BIGINT
  FROM phase_windows pw
  ORDER BY pw.phase_started, pw.id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION get_phase_durations IS 'Get phase timing for a feature using the v2 11-phase names and numbering.';

INSERT INTO audit_log (feature_id, operation, agent_name, details)
VALUES (
  NULL,
  'MIGRATION_007_PHASE_ALIGNMENT_APPLIED',
  'migration-007',
  jsonb_build_object(
    'applied_at', now(),
    'mapping', '0->0, 1->2, 2->3, 3->4, 4->5, 5->7, 6->8, 7->9, 8->10'
  )
);

-- ============================================================================
-- END OF PHASE ALIGNMENT
-- ============================================================================
