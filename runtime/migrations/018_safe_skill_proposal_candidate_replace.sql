-- Migration: 018_safe_skill_proposal_candidate_replace
-- Description: Repair skill proposal candidate sync to avoid unsafe broad DELETE statements.
-- Dependencies:
--   - 009_skill_proposal_candidates.sql

CREATE OR REPLACE FUNCTION replace_skill_proposal_candidates(p_candidates JSONB)
RETURNS VOID AS $$
BEGIN
  IF p_candidates IS NOT NULL AND jsonb_typeof(p_candidates) <> 'array' THEN
    RAISE EXCEPTION 'replace_skill_proposal_candidates expects a JSON array payload';
  END IF;

  TRUNCATE TABLE skill_proposal_evidence, skill_proposal_candidates;

  IF p_candidates IS NULL OR jsonb_typeof(p_candidates) <> 'array' OR jsonb_array_length(p_candidates) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO skill_proposal_candidates (
    topic_key,
    display_name,
    status,
    evidence_count,
    feature_count,
    sample_tags,
    latest_learning_at
  )
  SELECT
    candidate.topic_key,
    candidate.display_name,
    candidate.status,
    candidate.evidence_count,
    candidate.feature_count,
    candidate.sample_tags,
    candidate.latest_learning_at
  FROM jsonb_to_recordset(p_candidates) AS candidate(
    topic_key TEXT,
    display_name TEXT,
    status TEXT,
    evidence_count INTEGER,
    feature_count INTEGER,
    sample_tags TEXT[],
    latest_learning_at TIMESTAMPTZ,
    recent_examples JSONB
  );

  INSERT INTO skill_proposal_evidence (
    proposal_topic_key,
    learning_id,
    feature_id,
    title,
    learning_created_at
  )
  SELECT
    candidate.topic_key,
    evidence.learning_id,
    evidence.feature_id,
    evidence.title,
    evidence.created_at
  FROM jsonb_to_recordset(p_candidates) AS candidate(
    topic_key TEXT,
    display_name TEXT,
    status TEXT,
    evidence_count INTEGER,
    feature_count INTEGER,
    sample_tags TEXT[],
    latest_learning_at TIMESTAMPTZ,
    recent_examples JSONB
  )
  CROSS JOIN LATERAL jsonb_to_recordset(COALESCE(candidate.recent_examples, '[]'::jsonb)) AS evidence(
    learning_id UUID,
    feature_id TEXT,
    title TEXT,
    created_at TIMESTAMPTZ
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

COMMENT ON FUNCTION replace_skill_proposal_candidates(JSONB) IS 'Replace deterministic skill proposal candidate state and evidence in one explicit table replacement operation';
