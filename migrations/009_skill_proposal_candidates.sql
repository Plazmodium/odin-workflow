-- Migration: 009_skill_proposal_candidates
-- Description: Add relational storage for deterministic skill proposal candidates
--   derived from repeated unmatched learning domains.
-- Dependencies:
--   - 001_schema.sql (learnings table)
--   - 002_functions.sql (learning capture / propagation flow)
-- Rollback:
--   DROP TABLE IF EXISTS skill_proposal_evidence;
--   DROP TABLE IF EXISTS skill_proposal_candidates;

CREATE TABLE skill_proposal_candidates (
  topic_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CANDIDATE', 'DRAFT_READY')),
  evidence_count INTEGER NOT NULL CHECK (evidence_count >= 0),
  feature_count INTEGER NOT NULL CHECK (feature_count >= 0),
  sample_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  latest_learning_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE skill_proposal_candidates IS 'Derived candidates for generated skills based on repeated unresolved learning topics';

CREATE TABLE skill_proposal_evidence (
  proposal_topic_key TEXT NOT NULL REFERENCES skill_proposal_candidates(topic_key) ON DELETE CASCADE,
  learning_id UUID NOT NULL REFERENCES learnings(id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  learning_created_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_topic_key, learning_id)
);

COMMENT ON TABLE skill_proposal_evidence IS 'Recent learning evidence for each derived skill proposal candidate';

CREATE INDEX idx_skill_proposal_candidates_status ON skill_proposal_candidates(status);
CREATE INDEX idx_skill_proposal_candidates_latest_learning ON skill_proposal_candidates(latest_learning_at DESC);
CREATE INDEX idx_skill_proposal_evidence_feature_id ON skill_proposal_evidence(feature_id);
CREATE INDEX idx_skill_proposal_evidence_learning_created_at ON skill_proposal_evidence(learning_created_at DESC);

ALTER TABLE skill_proposal_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on skill_proposal_candidates"
  ON skill_proposal_candidates FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE skill_proposal_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on skill_proposal_evidence"
  ON skill_proposal_evidence FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION replace_skill_proposal_candidates(p_candidates JSONB)
RETURNS VOID AS $$
BEGIN
  IF p_candidates IS NOT NULL AND jsonb_typeof(p_candidates) <> 'array' THEN
    RAISE EXCEPTION 'replace_skill_proposal_candidates expects a JSON array payload';
  END IF;

  DELETE FROM skill_proposal_evidence;
  DELETE FROM skill_proposal_candidates;

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

COMMENT ON FUNCTION replace_skill_proposal_candidates(JSONB) IS 'Replace deterministic skill proposal candidate state and evidence in one transaction';
