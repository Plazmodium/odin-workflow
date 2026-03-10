# Odin SDD Framework - Database Migrations

This directory contains the consolidated database schema for Odin plus the later workflow extension migrations. The base 4 files replace the original 28 development migrations, providing a clean starting point for new installations.

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

-- 5. Workflow extension schema
\i 005_odin_v2_schema.sql

-- 6. Workflow extension functions
\i 006_odin_v2_functions.sql

-- 7. Phase alignment
\i 007_odin_v2_phase_alignment.sql
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
| `005_odin_v2_schema.sql` | Workflow extension schema | Product/Reviewer-ready phase enum, watcher/security tables |
| `006_odin_v2_functions.sql` | Workflow extension functions | Claims, policy engine, watcher review, security helpers |
| `007_odin_v2_phase_alignment.sql` | Phase alignment | Historical phase remap + current phase-numbering overrides |

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
SELECT * FROM transition_phase('FEAT-001', '3'::phase, 'architect-agent', 'Spec complete');

-- Track agent work duration
SELECT * FROM start_agent_invocation('FEAT-001', '3'::phase, 'architect-agent', 'Generating spec', ARRAY['frontend/nextjs-dev']);
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

The original development migrations are not shipped in this distribution repo; this folder contains the consolidated migration set users should apply.

## Post-Consolidation Migrations

These migrations were applied after the initial consolidation:

| Migration | Date | Description |
|-----------|------|-------------|
| `enforce_sequential_phase_transitions` | 2026-02-16 | Added phase ordering enforcement to `transition_phase()`. Forward transitions must advance exactly +1. Skipping phases is rejected with a descriptive error. |
| `fix_transition_phase_enum_values` | 2026-02-16 | Fixed enum values to match live DB (`BACKWARD` not `BACK`). |

**Note**: These changes are already incorporated into the consolidated `002_functions.sql` file. They are listed here for audit trail purposes.

## Workflow Extension Migrations

These migrations extend Odin with the current workflow features. **Run AFTER the base migrations (001-004).**

| Migration | Description |
|-----------|-------------|
| `005_odin_v2_schema.sql` | New enums, tables for 11-phase workflow, watchers, security findings |
| `006_odin_v2_functions.sql` | Functions for claims, policy engine, watcher reviews, security findings |
| `007_odin_v2_phase_alignment.sql` | Remaps persisted phase values and overrides core workflow functions to use the current numbering |

### Added Workflow Features

**11-Phase Workflow:**
```
Planning(0) → Product(1) → Discovery(2) → Architect(3) → Guardian(4) 
→ Builder(5) → Reviewer(6) → Integrator(7) → Documenter(8) → Release(9) → Complete(10)
```

**New Tables:**

| Table | Purpose |
|-------|---------|
| `agent_claims` | Structured claims from Builder/Integrator/Release for verification |
| `policy_verdicts` | Results from deterministic Policy Engine checks |
| `watcher_reviews` | Results from LLM Watcher escalation reviews |
| `security_findings` | SAST findings from Semgrep (Reviewer phase) |

**New Enums:**

| Enum | Values |
|------|--------|
| `claim_type` | CODE_ADDED, CODE_MODIFIED, TEST_PASSED, BUILD_SUCCEEDED, etc. |
| `verification_status` | PENDING, PASS, FAIL, NEEDS_REVIEW |
| `finding_severity` | INFO, LOW, MEDIUM, HIGH, CRITICAL |

**Key Functions:**

```sql
-- Submit a claim from an agent
SELECT * FROM submit_claim('FEAT-001', '5'::phase, 'builder-agent', 'CODE_ADDED', 
  'Added login component', '{"commit_sha": "abc123", "file_paths": ["src/login.tsx"]}'::jsonb, 'LOW');

-- Run policy checks (deterministic)
SELECT * FROM run_policy_checks('FEAT-001');

-- Get claims needing watcher review
SELECT * FROM get_claims_needing_review('FEAT-001');

-- Record watcher review (LLM escalation)
SELECT * FROM record_watcher_review(claim_id, 'PASS', 'Code change verified against spec', 'watcher-agent');

-- Record security finding from Semgrep
SELECT * FROM record_security_finding('FEAT-001', 'semgrep', 'HIGH', 
  'Potential SQL injection', 'src/api/users.ts', 42, 'sql-injection');

-- Check if can proceed past Reviewer
SELECT * FROM can_proceed_past_reviewer('FEAT-001');
```

### Running the Extension Migrations

```sql
-- After running 001-004, run the extension migrations:
\i 005_odin_v2_schema.sql
\i 006_odin_v2_functions.sql
\i 007_odin_v2_phase_alignment.sql
```

**Important**: Run `007_odin_v2_phase_alignment.sql` immediately after `005` and `006`, before any workflow activity creates rows in `agent_claims`, `policy_verdicts`, `watcher_reviews`, or `security_findings`.

Or via Supabase MCP:
```javascript
// Run via mcp_supabase_apply_migration with name '005_odin_v2_schema'
// Then run '006_odin_v2_functions'
// Then run '007_odin_v2_phase_alignment'
```

---

## Version

- **Schema Version**: 2.0.0
- **Created**: 2026-02-16
- **Last Updated**: 2026-03-09 (phase alignment migration added)
- **Consolidated from**: Migrations 001-028
