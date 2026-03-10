-- ============================================================================
-- Odin v2 Functions
-- Version: 2.0.0
-- Created: 2026-03-05
-- Description: Functions for Odin v2 features:
--   - Agent claims submission and verification
--   - Policy engine (deterministic checks)
--   - Watcher reviews (LLM escalation)
--   - Security findings management
--
-- Dependencies: Requires 005_odin_v2_schema.sql to be run first
--
-- IMPORTANT: DO NOT RUN ON SUPABASE UNTIL READY FOR DEPLOYMENT
-- ============================================================================

-- ============================================================================
-- AGENT CLAIMS FUNCTIONS
-- ============================================================================

-- Submit a claim from an agent
-- Used by Builder, Integrator, Release agents to assert work performed
CREATE OR REPLACE FUNCTION submit_claim(
  p_feature_id TEXT,
  p_phase phase,
  p_agent_name TEXT,
  p_claim_type claim_type,
  p_description TEXT,
  p_evidence_refs JSONB DEFAULT '{}'::jsonb,
  p_risk_level TEXT DEFAULT 'LOW',
  p_invocation_id UUID DEFAULT NULL
)
RETURNS TABLE (
  claim_id UUID,
  feature_id TEXT,
  phase phase,
  claim_type claim_type,
  risk_level TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_claim_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Validate risk level
  IF p_risk_level NOT IN ('LOW', 'MEDIUM', 'HIGH') THEN
    RAISE EXCEPTION 'Invalid risk_level: %. Must be LOW, MEDIUM, or HIGH.', p_risk_level;
  END IF;

  -- Insert claim
  INSERT INTO agent_claims (
    feature_id, phase, agent_name, claim_type, 
    claim_description, evidence_refs, risk_level, invocation_id
  ) VALUES (
    p_feature_id, p_phase, p_agent_name, p_claim_type,
    p_description, p_evidence_refs, p_risk_level, p_invocation_id
  )
  RETURNING id, agent_claims.created_at INTO v_claim_id, v_created_at;

  -- Log to audit
  INSERT INTO audit_log (feature_id, operation, agent_name, details)
  VALUES (p_feature_id, 'CLAIM_SUBMITTED', p_agent_name, jsonb_build_object(
    'table_name', 'agent_claims',
    'record_id', v_claim_id::text,
    'phase', p_phase,
    'claim_type', p_claim_type,
    'risk_level', p_risk_level
  ));

  RETURN QUERY SELECT v_claim_id, p_feature_id, p_phase, p_claim_type, p_risk_level, v_created_at;
END;
$$;

COMMENT ON FUNCTION submit_claim IS 'Submit a structured claim from an agent. Returns the created claim record.';

-- Get all claims for a feature
CREATE OR REPLACE FUNCTION get_feature_claims(p_feature_id TEXT)
RETURNS TABLE (
  claim_id UUID,
  phase phase,
  agent_name TEXT,
  claim_type claim_type,
  claim_description TEXT,
  evidence_refs JSONB,
  risk_level TEXT,
  policy_verdict verification_status,
  watcher_verdict verification_status,
  final_status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ac.id AS claim_id,
    ac.phase,
    ac.agent_name,
    ac.claim_type,
    ac.claim_description,
    ac.evidence_refs,
    ac.risk_level,
    pv.verdict AS policy_verdict,
    wr.verdict AS watcher_verdict,
    CASE 
      WHEN wr.verdict IS NOT NULL THEN wr.verdict::text
      WHEN pv.verdict IS NOT NULL THEN pv.verdict::text
      ELSE 'PENDING'
    END AS final_status,
    ac.created_at
  FROM agent_claims ac
  LEFT JOIN policy_verdicts pv ON ac.id = pv.claim_id
  LEFT JOIN watcher_reviews wr ON ac.id = wr.claim_id
  WHERE ac.feature_id = p_feature_id
  ORDER BY ac.created_at;
END;
$$;

COMMENT ON FUNCTION get_feature_claims IS 'Get all claims for a feature with their verification status';

-- ============================================================================
-- POLICY ENGINE FUNCTIONS
-- ============================================================================

-- Record a policy verdict
CREATE OR REPLACE FUNCTION record_policy_verdict(
  p_claim_id UUID,
  p_verdict verification_status,
  p_rule_name TEXT,
  p_reason TEXT DEFAULT NULL,
  p_evidence_checked JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  verdict_id UUID,
  claim_id UUID,
  verdict verification_status,
  rule_name TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_verdict_id UUID;
  v_feature_id TEXT;
  v_agent_name TEXT;
BEGIN
  -- Get claim info for audit
  SELECT ac.feature_id, ac.agent_name INTO v_feature_id, v_agent_name
  FROM agent_claims ac WHERE ac.id = p_claim_id;

  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'Claim not found: %', p_claim_id;
  END IF;

  -- Insert verdict
  INSERT INTO policy_verdicts (
    claim_id, verdict, rule_name, reason, evidence_checked
  ) VALUES (
    p_claim_id, p_verdict, p_rule_name, p_reason, p_evidence_checked
  )
  RETURNING id INTO v_verdict_id;

  -- Log to audit
  INSERT INTO audit_log (feature_id, operation, agent_name, details)
  VALUES (v_feature_id, 'POLICY_VERDICT', 'policy-engine', jsonb_build_object(
    'table_name', 'policy_verdicts',
    'record_id', v_verdict_id::text,
    'claim_id', p_claim_id,
    'verdict', p_verdict,
    'rule_name', p_rule_name
  ));

  RETURN QUERY SELECT v_verdict_id, p_claim_id, p_verdict, p_rule_name;
END;
$$;

COMMENT ON FUNCTION record_policy_verdict IS 'Record the result of a deterministic policy check on a claim';

-- Policy engine: verify claim has evidence
-- Returns PASS if evidence present and not high-risk
-- Returns NEEDS_REVIEW if evidence missing or high-risk
CREATE OR REPLACE FUNCTION policy_verify_evidence(p_claim_id UUID)
RETURNS verification_status
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_claim agent_claims%ROWTYPE;
  v_verdict verification_status;
  v_reason TEXT;
BEGIN
  SELECT * INTO v_claim FROM agent_claims WHERE id = p_claim_id;
  
  IF v_claim IS NULL THEN
    RAISE EXCEPTION 'Claim not found: %', p_claim_id;
  END IF;
  
  -- Determine verdict
  IF v_claim.evidence_refs IS NULL OR v_claim.evidence_refs = '{}'::jsonb THEN
    v_verdict := 'NEEDS_REVIEW';
    v_reason := 'Missing evidence references - escalate to watcher';
  ELSIF v_claim.risk_level = 'HIGH' THEN
    v_verdict := 'NEEDS_REVIEW';
    v_reason := 'High risk claim - requires watcher review';
  ELSE
    v_verdict := 'PASS';
    v_reason := 'Evidence references present';
  END IF;
  
  -- Record the verdict
  PERFORM record_policy_verdict(
    p_claim_id,
    v_verdict,
    'evidence_check',
    v_reason,
    v_claim.evidence_refs
  );
  
  RETURN v_verdict;
END;
$$;

COMMENT ON FUNCTION policy_verify_evidence IS 'Deterministic check: verify claim has evidence refs. Escalates to watcher if missing or high-risk.';

-- Run all policy checks on pending claims for a feature
CREATE OR REPLACE FUNCTION run_policy_checks(p_feature_id TEXT)
RETURNS TABLE (
  claim_id UUID,
  claim_type claim_type,
  verdict verification_status,
  needs_watcher BOOLEAN
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_claim RECORD;
  v_verdict verification_status;
BEGIN
  FOR v_claim IN
    SELECT ac.id, ac.claim_type
    FROM agent_claims ac
    LEFT JOIN policy_verdicts pv ON ac.id = pv.claim_id
    WHERE ac.feature_id = p_feature_id
      AND pv.id IS NULL  -- No verdict yet
    ORDER BY ac.created_at
  LOOP
    -- Run evidence check
    v_verdict := policy_verify_evidence(v_claim.id);
    
    claim_id := v_claim.id;
    claim_type := v_claim.claim_type;
    verdict := v_verdict;
    needs_watcher := (v_verdict = 'NEEDS_REVIEW');
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION run_policy_checks IS 'Run all pending policy checks for a feature. Returns claims needing watcher review.';

-- ============================================================================
-- WATCHER FUNCTIONS
-- ============================================================================

-- Record a watcher review result
CREATE OR REPLACE FUNCTION record_watcher_review(
  p_claim_id UUID,
  p_verdict verification_status,
  p_reasoning TEXT,
  p_watcher_agent TEXT,
  p_confidence DECIMAL DEFAULT 0.80
)
RETURNS TABLE (
  review_id UUID,
  claim_id UUID,
  verdict verification_status,
  confidence DECIMAL
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_review_id UUID;
  v_feature_id TEXT;
BEGIN
  -- Get claim info for audit
  SELECT ac.feature_id INTO v_feature_id
  FROM agent_claims ac WHERE ac.id = p_claim_id;

  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'Claim not found: %', p_claim_id;
  END IF;

  -- Insert review
  INSERT INTO watcher_reviews (
    claim_id, verdict, confidence, reasoning, watcher_agent
  ) VALUES (
    p_claim_id, p_verdict, p_confidence, p_reasoning, p_watcher_agent
  )
  RETURNING id INTO v_review_id;

  -- Log to audit
  INSERT INTO audit_log (feature_id, operation, agent_name, details)
  VALUES (v_feature_id, 'WATCHER_REVIEW', p_watcher_agent, jsonb_build_object(
    'table_name', 'watcher_reviews',
    'record_id', v_review_id::text,
    'claim_id', p_claim_id,
    'verdict', p_verdict,
    'confidence', p_confidence
  ));

  RETURN QUERY SELECT v_review_id, p_claim_id, p_verdict, p_confidence;
END;
$$;

COMMENT ON FUNCTION record_watcher_review IS 'Record the result of an LLM watcher review on an escalated claim';

-- Get claims needing watcher review
CREATE OR REPLACE FUNCTION get_claims_needing_review(p_feature_id TEXT DEFAULT NULL)
RETURNS TABLE (
  claim_id UUID,
  feature_id TEXT,
  phase phase,
  agent_name TEXT,
  claim_type claim_type,
  claim_description TEXT,
  evidence_refs JSONB,
  risk_level TEXT,
  policy_verdict verification_status,
  policy_reason TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ac.id AS claim_id,
    ac.feature_id,
    ac.phase,
    ac.agent_name,
    ac.claim_type,
    ac.claim_description,
    ac.evidence_refs,
    ac.risk_level,
    pv.verdict AS policy_verdict,
    pv.reason AS policy_reason,
    ac.created_at
  FROM agent_claims ac
  LEFT JOIN policy_verdicts pv ON ac.id = pv.claim_id
  LEFT JOIN watcher_reviews wr ON ac.id = wr.claim_id
  WHERE (pv.verdict = 'NEEDS_REVIEW' OR ac.risk_level = 'HIGH')
    AND wr.id IS NULL  -- No watcher review yet
    AND (p_feature_id IS NULL OR ac.feature_id = p_feature_id)
  ORDER BY 
    CASE WHEN ac.risk_level = 'HIGH' THEN 0 ELSE 1 END,
    ac.created_at;
END;
$$;

COMMENT ON FUNCTION get_claims_needing_review IS 'Get claims that need LLM watcher review (escalated or high-risk)';

-- Get verification summary for a feature
CREATE OR REPLACE FUNCTION get_verification_summary(p_feature_id TEXT)
RETURNS TABLE (
  total_claims INTEGER,
  policy_pass INTEGER,
  policy_fail INTEGER,
  policy_needs_review INTEGER,
  watcher_pass INTEGER,
  watcher_fail INTEGER,
  pending_review INTEGER,
  all_verified BOOLEAN
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claim_stats AS (
    SELECT 
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE pv.verdict = 'PASS') AS p_pass,
      COUNT(*) FILTER (WHERE pv.verdict = 'FAIL') AS p_fail,
      COUNT(*) FILTER (WHERE pv.verdict = 'NEEDS_REVIEW') AS p_review,
      COUNT(*) FILTER (WHERE wr.verdict = 'PASS') AS w_pass,
      COUNT(*) FILTER (WHERE wr.verdict = 'FAIL') AS w_fail,
      COUNT(*) FILTER (WHERE pv.verdict = 'NEEDS_REVIEW' AND wr.id IS NULL) AS pending
    FROM agent_claims ac
    LEFT JOIN policy_verdicts pv ON ac.id = pv.claim_id
    LEFT JOIN watcher_reviews wr ON ac.id = wr.claim_id
    WHERE ac.feature_id = p_feature_id
  )
  SELECT 
    cs.total::INTEGER,
    cs.p_pass::INTEGER,
    cs.p_fail::INTEGER,
    cs.p_review::INTEGER,
    cs.w_pass::INTEGER,
    cs.w_fail::INTEGER,
    cs.pending::INTEGER,
    (cs.p_fail = 0 AND cs.w_fail = 0 AND cs.pending = 0)
  FROM claim_stats cs;
END;
$$;

COMMENT ON FUNCTION get_verification_summary IS 'Get summary of claim verification status for a feature';

-- ============================================================================
-- SECURITY FINDINGS FUNCTIONS
-- ============================================================================

-- Record a security finding from SAST tool
CREATE OR REPLACE FUNCTION record_security_finding(
  p_feature_id TEXT,
  p_tool TEXT,
  p_severity finding_severity,
  p_message TEXT,
  p_file_path TEXT DEFAULT NULL,
  p_line_number INTEGER DEFAULT NULL,
  p_rule_id TEXT DEFAULT NULL,
  p_snippet TEXT DEFAULT NULL,
  p_fix_suggestion TEXT DEFAULT NULL,
  p_column_number INTEGER DEFAULT NULL,
  p_end_line INTEGER DEFAULT NULL,
  p_end_column INTEGER DEFAULT NULL
)
RETURNS TABLE (
  finding_id UUID,
  feature_id TEXT,
  severity finding_severity,
  is_blocking BOOLEAN
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_finding_id UUID;
BEGIN
  INSERT INTO security_findings (
    feature_id, tool, severity, message, file_path, line_number,
    rule_id, snippet, fix_suggestion, column_number, end_line, end_column
  ) VALUES (
    p_feature_id, p_tool, p_severity, p_message, p_file_path, p_line_number,
    p_rule_id, p_snippet, p_fix_suggestion, p_column_number, p_end_line, p_end_column
  )
  RETURNING id INTO v_finding_id;

  -- Log to audit
  INSERT INTO audit_log (feature_id, operation, agent_name, details)
  VALUES (p_feature_id, 'SECURITY_FINDING', 'reviewer-agent', jsonb_build_object(
    'table_name', 'security_findings',
    'record_id', v_finding_id::text,
    'tool', p_tool,
    'severity', p_severity,
    'rule_id', p_rule_id,
    'file_path', p_file_path
  ));

  RETURN QUERY SELECT 
    v_finding_id, 
    p_feature_id, 
    p_severity,
    (p_severity IN ('HIGH', 'CRITICAL'));
END;
$$;

COMMENT ON FUNCTION record_security_finding IS 'Record a security finding from a SAST tool. Returns whether the finding blocks progression.';

-- Resolve a security finding
CREATE OR REPLACE FUNCTION resolve_security_finding(
  p_finding_id UUID,
  p_resolved_by TEXT,
  p_resolution_note TEXT DEFAULT NULL
)
RETURNS TABLE (
  finding_id UUID,
  resolved BOOLEAN,
  resolved_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_feature_id TEXT;
  v_resolved_at TIMESTAMPTZ;
BEGIN
  -- Get feature_id for audit
  SELECT sf.feature_id INTO v_feature_id
  FROM security_findings sf WHERE sf.id = p_finding_id;

  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'Finding not found: %', p_finding_id;
  END IF;

  -- Update finding
  UPDATE security_findings sf
  SET resolved = true,
      resolved_by = p_resolved_by,
      resolved_at = now(),
      resolution_note = p_resolution_note
  WHERE sf.id = p_finding_id
  RETURNING sf.resolved_at INTO v_resolved_at;

  -- Log to audit
  INSERT INTO audit_log (feature_id, operation, agent_name, details)
  VALUES (v_feature_id, 'FINDING_RESOLVED', p_resolved_by, jsonb_build_object(
    'table_name', 'security_findings',
    'record_id', p_finding_id::text,
    'resolution_note', p_resolution_note
  ));

  RETURN QUERY SELECT p_finding_id, true, v_resolved_at;
END;
$$;

COMMENT ON FUNCTION resolve_security_finding IS 'Mark a security finding as resolved with optional note';

-- Get unresolved security findings for a feature
CREATE OR REPLACE FUNCTION get_unresolved_findings(p_feature_id TEXT)
RETURNS TABLE (
  id UUID,
  tool TEXT,
  severity finding_severity,
  rule_id TEXT,
  file_path TEXT,
  line_number INTEGER,
  message TEXT,
  snippet TEXT,
  fix_suggestion TEXT,
  is_blocking BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sf.id, sf.tool, sf.severity, sf.rule_id,
    sf.file_path, sf.line_number, sf.message, sf.snippet, sf.fix_suggestion,
    (sf.severity IN ('HIGH', 'CRITICAL')) AS is_blocking,
    sf.created_at
  FROM security_findings sf
  WHERE sf.feature_id = p_feature_id
    AND sf.resolved = false
  ORDER BY 
    CASE sf.severity 
      WHEN 'CRITICAL' THEN 0
      WHEN 'HIGH' THEN 1
      WHEN 'MEDIUM' THEN 2
      WHEN 'LOW' THEN 3
      ELSE 4
    END,
    sf.created_at;
END;
$$;

COMMENT ON FUNCTION get_unresolved_findings IS 'Get all unresolved security findings for a feature, ordered by severity';

-- Check if feature can proceed past Reviewer phase
CREATE OR REPLACE FUNCTION can_proceed_past_reviewer(p_feature_id TEXT)
RETURNS TABLE (
  can_proceed BOOLEAN,
  blocking_count INTEGER,
  total_findings INTEGER,
  reason TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_blocking_count INTEGER;
  v_total_count INTEGER;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE severity IN ('HIGH', 'CRITICAL') AND resolved = false),
    COUNT(*) FILTER (WHERE resolved = false)
  INTO v_blocking_count, v_total_count
  FROM security_findings
  WHERE feature_id = p_feature_id;
  
  RETURN QUERY
  SELECT 
    v_blocking_count = 0,
    v_blocking_count,
    v_total_count,
    CASE 
      WHEN v_blocking_count = 0 AND v_total_count = 0 THEN 'No security findings'
      WHEN v_blocking_count = 0 THEN v_total_count || ' non-blocking findings (can proceed)'
      ELSE v_blocking_count || ' unresolved HIGH/CRITICAL findings (must resolve before proceeding)'
    END;
END;
$$;

COMMENT ON FUNCTION can_proceed_past_reviewer IS 'Check if a feature can proceed past Reviewer phase (no unresolved HIGH/CRITICAL findings)';

-- Get security findings summary for a feature
CREATE OR REPLACE FUNCTION get_security_summary(p_feature_id TEXT)
RETURNS TABLE (
  total_findings INTEGER,
  critical_count INTEGER,
  high_count INTEGER,
  medium_count INTEGER,
  low_count INTEGER,
  info_count INTEGER,
  resolved_count INTEGER,
  unresolved_blocking INTEGER,
  can_proceed BOOLEAN
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_findings,
    COUNT(*) FILTER (WHERE severity = 'CRITICAL')::INTEGER AS critical_count,
    COUNT(*) FILTER (WHERE severity = 'HIGH')::INTEGER AS high_count,
    COUNT(*) FILTER (WHERE severity = 'MEDIUM')::INTEGER AS medium_count,
    COUNT(*) FILTER (WHERE severity = 'LOW')::INTEGER AS low_count,
    COUNT(*) FILTER (WHERE severity = 'INFO')::INTEGER AS info_count,
    COUNT(*) FILTER (WHERE resolved = true)::INTEGER AS resolved_count,
    COUNT(*) FILTER (WHERE resolved = false AND severity IN ('HIGH', 'CRITICAL'))::INTEGER AS unresolved_blocking,
    (COUNT(*) FILTER (WHERE resolved = false AND severity IN ('HIGH', 'CRITICAL')) = 0) AS can_proceed
  FROM security_findings
  WHERE feature_id = p_feature_id;
END;
$$;

COMMENT ON FUNCTION get_security_summary IS 'Get summary of security findings for a feature by severity';

-- ============================================================================
-- PHASE NAME HELPER (UPDATED FOR V2)
-- ============================================================================

-- Get phase name for v2 workflow
CREATE OR REPLACE FUNCTION get_phase_name_v2(p_phase phase)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN CASE p_phase
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
  END;
END;
$$;

COMMENT ON FUNCTION get_phase_name_v2 IS 'Get human-readable name for v2 workflow phase (11 phases)';

-- ============================================================================
-- END OF FUNCTIONS
-- ============================================================================
