-- ============================================================================
-- Odin SDD Framework - Seed Data
-- Version: 1.0.0
-- Created: 2026-02-16
-- Description: Initial seed data for Odin. Run after 003_views.sql.
--   Contains batch templates for common operations.
-- ============================================================================

-- ============================================================================
-- BATCH TEMPLATES
-- ============================================================================

-- Clear existing templates (idempotent)
DELETE FROM batch_templates WHERE created_by = 'system';

-- Template: Full Feature Status
INSERT INTO batch_templates (name, description, params, steps, output_config, created_by)
VALUES (
  'feature_full_status',
  'Get complete feature status including durations, gates, blockers, transitions',
  '[{"name": "feature_id", "type": "string", "required": true}]',
  '[
    {"step_id": 0, "tool": "get_feature", "args": {"feature_id": "$params.feature_id"}, "on_error": "fail"},
    {"step_id": 1, "tool": "get_phase_durations", "args": {"feature_id": "$params.feature_id"}, "on_error": "continue"},
    {"step_id": 2, "tool": "get_quality_gates", "args": {"feature_id": "$params.feature_id"}, "on_error": "continue"},
    {"step_id": 3, "tool": "get_blockers", "args": {"feature_id": "$params.feature_id"}, "on_error": "continue"},
    {"step_id": 4, "tool": "get_phase_transitions", "args": {"feature_id": "$params.feature_id"}, "on_error": "continue"}
  ]',
  '{"include_steps": [0,1,2,3,4], "format": "full"}',
  'system'
);

-- Template: Feature with Learnings
INSERT INTO batch_templates (name, description, params, steps, output_config, created_by)
VALUES (
  'feature_with_learnings',
  'Get feature status plus all associated learnings',
  '[{"name": "feature_id", "type": "string", "required": true}]',
  '[
    {"step_id": 0, "tool": "get_feature", "args": {"feature_id": "$params.feature_id"}, "on_error": "fail"},
    {"step_id": 1, "tool": "get_learnings_for_feature", "args": {"feature_id": "$params.feature_id"}, "on_error": "continue"},
    {"step_id": 2, "tool": "compute_feature_eval", "args": {"feature_id": "$params.feature_id"}, "on_error": "skip"}
  ]',
  '{"include_steps": [0,1,2], "format": "full"}',
  'system'
);

-- Template: System Health Check
INSERT INTO batch_templates (name, description, params, steps, output_config, created_by)
VALUES (
  'system_health_check',
  'Get system health, active alerts, and blocked features',
  '[]',
  '[
    {"step_id": 0, "tool": "get_system_health", "args": {}, "on_error": "continue"},
    {"step_id": 1, "tool": "get_active_alerts", "args": {}, "on_error": "continue"},
    {"step_id": 2, "tool": "list_features", "args": {"status": "BLOCKED"}, "on_error": "continue"}
  ]',
  '{"include_steps": [0,1,2], "format": "full"}',
  'system'
);

-- Template: Learning Evolution
INSERT INTO batch_templates (name, description, params, steps, output_config, created_by)
VALUES (
  'learning_evolution',
  'Get full evolution chain for a learning',
  '[{"name": "learning_id", "type": "uuid", "required": true}]',
  '[
    {"step_id": 0, "tool": "get_learning", "args": {"learning_id": "$params.learning_id"}, "on_error": "fail"},
    {"step_id": 1, "tool": "get_learning_chain", "args": {"learning_id": "$params.learning_id"}, "on_error": "continue"},
    {"step_id": 2, "tool": "detect_conflicts", "args": {"learning_id": "$params.learning_id"}, "on_error": "skip"}
  ]',
  '{"include_steps": [0,1,2], "format": "full"}',
  'system'
);

-- Template: Propagation Review
INSERT INTO batch_templates (name, description, params, steps, output_config, created_by)
VALUES (
  'propagation_review',
  'Get learnings ready for propagation and any open conflicts',
  '[]',
  '[
    {"step_id": 0, "tool": "get_propagation_queue", "args": {}, "on_error": "continue"},
    {"step_id": 1, "tool": "get_open_conflicts", "args": {}, "on_error": "continue"}
  ]',
  '{"include_steps": [0,1], "format": "full"}',
  'system'
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all templates were inserted
DO $$
DECLARE
  template_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO template_count FROM batch_templates WHERE created_by = 'system';
  IF template_count != 5 THEN
    RAISE EXCEPTION 'Expected 5 system templates, found %', template_count;
  END IF;
  RAISE NOTICE 'Seed data verified: % batch templates created', template_count;
END $$;
