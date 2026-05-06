-- Migration: 015_watcher_review_independence
-- Description: Persist watcher review independence metadata and refresh the watcher review RPC signature.
-- Dependencies:
--   - 005_odin_v2_schema.sql

ALTER TABLE watcher_reviews
  ADD COLUMN IF NOT EXISTS watcher_session_id TEXT,
  ADD COLUMN IF NOT EXISTS trust_level TEXT NOT NULL DEFAULT 'independent' CHECK (trust_level IN ('independent', 'self_review', 'override')),
  ADD COLUMN IF NOT EXISTS independence_override_reason TEXT;

COMMENT ON COLUMN watcher_reviews.watcher_session_id IS 'Harness/session id for the watcher review worker when available.';
COMMENT ON COLUMN watcher_reviews.trust_level IS 'Whether Odin could distinguish this watcher review from self-review.';
COMMENT ON COLUMN watcher_reviews.independence_override_reason IS 'Explicit reason supplied when a self-review or unknown-session PASS was accepted.';

DROP FUNCTION IF EXISTS record_watcher_review(UUID, verification_status, TEXT, TEXT, DECIMAL);

CREATE OR REPLACE FUNCTION record_watcher_review(
  p_claim_id UUID,
  p_verdict verification_status,
  p_reasoning TEXT,
  p_watcher_agent TEXT,
  p_confidence DECIMAL DEFAULT 0.80,
  p_watcher_session_id TEXT DEFAULT NULL,
  p_trust_level TEXT DEFAULT 'independent',
  p_independence_override_reason TEXT DEFAULT NULL
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
  IF p_trust_level NOT IN ('independent', 'self_review', 'override') THEN
    RAISE EXCEPTION 'Invalid watcher trust_level: %. Must be independent, self_review, or override.', p_trust_level;
  END IF;

  SELECT ac.feature_id INTO v_feature_id
  FROM agent_claims ac WHERE ac.id = p_claim_id;

  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'Claim not found: %', p_claim_id;
  END IF;

  INSERT INTO watcher_reviews (
    claim_id,
    verdict,
    confidence,
    reasoning,
    watcher_agent,
    watcher_session_id,
    trust_level,
    independence_override_reason
  ) VALUES (
    p_claim_id,
    p_verdict,
    p_confidence,
    p_reasoning,
    p_watcher_agent,
    p_watcher_session_id,
    p_trust_level,
    p_independence_override_reason
  )
  RETURNING id INTO v_review_id;

  INSERT INTO audit_log (feature_id, operation, agent_name, details)
  VALUES (v_feature_id, 'WATCHER_REVIEW', p_watcher_agent, jsonb_build_object(
    'table_name', 'watcher_reviews',
    'record_id', v_review_id::text,
    'claim_id', p_claim_id,
    'verdict', p_verdict,
    'confidence', p_confidence,
    'watcher_session_id', p_watcher_session_id,
    'trust_level', p_trust_level,
    'independence_override_reason', p_independence_override_reason
  ));

  RETURN QUERY SELECT v_review_id, p_claim_id, p_verdict, p_confidence;
END;
$$;

COMMENT ON FUNCTION record_watcher_review IS 'Record the result of an LLM watcher review on an escalated claim, including independence metadata.';
