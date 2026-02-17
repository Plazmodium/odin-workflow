# Odin SDD Framework - Database Migrations

This directory contains the consolidated database schema for Odin. These 4 files replace the original 28 development migrations, providing a clean starting point for new installations.

## Quick Start

Run these migrations in order on a fresh Supabase project:

```sql
-- 1. Schema (tables, enums, indexes, RLS)
\i 001_schema.sql

-- 2. Functions (all PostgreSQL functions)
\i 002_functions.sql

-- 3. Views (all database views)
\i 003_views.sql

-- 4. Seed data (batch templates)
\i 004_seed.sql
```

Or via Supabase MCP:

```javascript
// Run each file via mcp_supabase_apply_migration
// The 'name' parameter should match the file name (without .sql)
```

## File Overview

| File | Purpose | Objects |
|------|---------|---------|
| `001_schema.sql` | Core schema | 23 tables, 16 enums, 60+ indexes, RLS policies, 1 trigger |
| `002_functions.sql` | Business logic | 30+ functions (workflow, invocations, git, learnings, evals) |
| `003_views.sql` | Dashboard views | 12 views (features, learnings, evals, batch) |
| `004_seed.sql` | Initial data | 5 batch templates |

## Schema Summary

### Core Tables

| Table | Purpose |
|-------|---------|
| `features` | Central work items tracked through the SDD workflow |
| `phase_transitions` | Audit trail of phase changes |
| `quality_gates` | Approval checkpoints |
| `blockers` | Issues preventing progress |
| `agent_invocations` | Duration tracking per agent call |
| `feature_commits` | Git commits per feature |
| `phase_outputs` | Structured phase artifacts (requirements, perspectives, tasks) |

### Learning System

| Table | Purpose |
|-------|---------|
| `learnings` | Evolving knowledge base with confidence scoring |
| `learning_conflicts` | Contradicting learnings requiring resolution |
| `learning_propagation_targets` | Where learnings SHOULD be propagated |
| `learning_propagations` | Where learnings HAVE BEEN propagated |

### EVALS System

| Table | Purpose |
|-------|---------|
| `feature_evals` | Performance snapshots for features |
| `system_health_evals` | System-wide health (7/30/90 day windows) |
| `eval_alerts` | Alerts from threshold breaches |

### Key Functions

```sql
-- Create a feature with git branch tracking
SELECT * FROM create_feature('FEAT-001', 'My Feature', 2, 'ROUTINE', NULL, NULL, 'orchestrator', 'jd', 'main', 'John Doe');

-- Transition to a new phase (enforces sequential ordering — no skipping!)
SELECT * FROM transition_phase('FEAT-001', '2'::phase, 'architect-agent', 'Spec complete');

-- Track agent work duration
SELECT * FROM start_agent_invocation('FEAT-001', '2'::phase, 'architect-agent', 'Generating spec', ARRAY['frontend/nextjs-dev']);
SELECT * FROM end_agent_invocation(invocation_id);

-- Complete a feature (computes eval)
SELECT * FROM complete_feature('FEAT-001', 'release-agent');

-- Get comprehensive feature status
SELECT * FROM get_feature_status('FEAT-001');
```

## Security

All tables have Row Level Security (RLS) enabled with `service_role` full access policies. Views use `security_invoker = true` to prevent SECURITY DEFINER bypasses.

## Development History

These consolidated migrations replace the original 28 development migrations (001-028) which evolved over the course of building Odin. Key architectural changes included:

- **Migration 016**: Removed token budget tracking, added duration-based tracking
- **Migration 017**: Added git branch and commit tracking
- **Migration 021**: Added multi-target propagation for learnings
- **Migration 023**: Added author field for multi-developer support
- **Migration 026**: Added phase_outputs for structured artifacts

The original development migrations are not included in this distribution.

## Post-Consolidation Migrations

These migrations were applied after the initial consolidation:

| Migration | Date | Description |
|-----------|------|-------------|
| `enforce_sequential_phase_transitions` | 2026-02-16 | Added phase ordering enforcement to `transition_phase()`. Forward transitions must advance exactly +1. Skipping phases is rejected with a descriptive error. |
| `fix_transition_phase_enum_values` | 2026-02-16 | Fixed enum values to match live DB (`BACKWARD` not `BACK`). |

**Note**: These changes are already incorporated into the consolidated `002_functions.sql` file. They are listed here for audit trail purposes.

## Version

- **Schema Version**: 1.0.1
- **Created**: 2026-02-16
- **Last Updated**: 2026-02-16 (phase enforcement + schema drift fixes)
- **Consolidated from**: Migrations 001-028
