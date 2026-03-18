-- Migration: 008_related_learnings
-- Created: 2026-03-17
-- Description: Add get_related_learnings() function for cross-feature knowledge retrieval.
--   Finds learnings from other features that share propagation targets with the given feature's learnings.
--   Falls back to tag intersection (>= 2 shared tags) when the feature has no propagation targets.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS get_related_learnings(TEXT, INT);

CREATE OR REPLACE FUNCTION get_related_learnings(p_feature_id TEXT, p_limit INT DEFAULT 5)
RETURNS TABLE(
  id UUID,
  title TEXT,
  category TEXT,
  content TEXT,
  confidence_score NUMERIC,
  source_feature_id TEXT,
  shared_domains TEXT[],
  shared_domain_count INT
)
AS $$
  WITH feature_targets AS (
    SELECT DISTINCT lpt.target_type, lpt.target_path
    FROM learning_propagation_targets lpt
    JOIN learnings l ON l.id = lpt.learning_id
    WHERE l.feature_id = p_feature_id
  ),
  target_count AS (
    SELECT count(*) AS cnt FROM feature_targets
  ),
  -- Primary path: shared propagation targets
  target_candidates AS (
    SELECT
      l.id, l.title, l.category::TEXT, l.content, l.confidence_score,
      l.feature_id AS source_feature_id,
      array_agg(DISTINCT lpt.target_type || ':' || COALESCE(lpt.target_path, '')
        ORDER BY lpt.target_type || ':' || COALESCE(lpt.target_path, '')) AS shared_domains,
      count(DISTINCT (lpt.target_type, lpt.target_path))::INT AS shared_domain_count
    FROM learnings l
    JOIN learning_propagation_targets lpt ON lpt.learning_id = l.id
    JOIN feature_targets ft ON ft.target_type = lpt.target_type
      AND (ft.target_path = lpt.target_path OR (ft.target_path IS NULL AND lpt.target_path IS NULL))
    WHERE l.feature_id != p_feature_id
      AND l.is_superseded = false
      AND l.confidence_score >= 0.70
    GROUP BY l.id, l.title, l.category, l.content, l.confidence_score, l.feature_id
  ),
  -- Fallback path: tag intersection (>= 2 shared tags) when no propagation targets exist
  feature_tags AS (
    SELECT DISTINCT unnest(l.tags) AS tag
    FROM learnings l
    WHERE l.feature_id = p_feature_id
      AND l.tags IS NOT NULL
      AND array_length(l.tags, 1) > 0
  ),
  tag_candidates AS (
    SELECT
      l.id, l.title, l.category::TEXT, l.content, l.confidence_score,
      l.feature_id AS source_feature_id,
      array_agg(DISTINCT ft.tag ORDER BY ft.tag) AS shared_domains,
      count(DISTINCT ft.tag)::INT AS shared_domain_count
    FROM learnings l,
    LATERAL unnest(l.tags) AS lt(tag)
    JOIN feature_tags ft ON ft.tag = lt.tag
    WHERE l.feature_id != p_feature_id
      AND l.is_superseded = false
      AND l.confidence_score >= 0.70
      AND (SELECT cnt FROM target_count) = 0
    GROUP BY l.id, l.title, l.category, l.content, l.confidence_score, l.feature_id
    HAVING count(DISTINCT ft.tag) >= 2
  ),
  combined AS (
    SELECT * FROM target_candidates
    UNION ALL
    SELECT * FROM tag_candidates
  )
  SELECT * FROM combined
  ORDER BY shared_domain_count DESC, confidence_score DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE SET search_path = public;
