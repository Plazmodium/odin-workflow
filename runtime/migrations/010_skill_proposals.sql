-- Migration: 010_skill_proposals
-- Description: Add draft/approval/publish storage for governed generated-skill proposals.
-- Dependencies:
--   - 009_skill_proposal_candidates.sql
-- Rollback:
--   DROP TABLE IF EXISTS skill_proposals;

CREATE TABLE skill_proposals (
  topic_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'APPROVED', 'REJECTED', 'PUBLISHED')),
  skill_name TEXT NOT NULL,
  skill_category TEXT NOT NULL,
  draft_markdown TEXT NOT NULL,
  validation_errors TEXT[] NOT NULL DEFAULT '{}'::text[],
  validation_warnings TEXT[] NOT NULL DEFAULT '{}'::text[],
  decision_notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  published_by TEXT,
  published_at TIMESTAMPTZ,
  published_path TEXT
);

COMMENT ON TABLE skill_proposals IS 'Draft, approval, and publish state for governed generated-skill proposals';

CREATE INDEX idx_skill_proposals_status ON skill_proposals(status);
CREATE INDEX idx_skill_proposals_updated_at ON skill_proposals(updated_at DESC);
CREATE INDEX idx_skill_proposals_skill_name ON skill_proposals(skill_name);

ALTER TABLE skill_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on skill_proposals"
  ON skill_proposals FOR ALL TO service_role USING (true) WITH CHECK (true);
