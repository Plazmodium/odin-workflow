# Odin Schema Migrations

These SQL migration files define the Odin database schema. They are applied sequentially by the `odin.apply_migrations` tool using either direct PostgreSQL (`DATABASE_URL`) or the Supabase Management API (`SUPABASE_URL` + `SUPABASE_ACCESS_TOKEN`).

This is reference material for the packaged migration files. Most users should ask their AI agent to run `odin.apply_migrations` instead of working through these files manually.

## Usage

The `odin.apply_migrations` tool will:
1. Create an `odin_migrations` tracking table (if it doesn't exist)
2. Check which migrations have already been applied
3. Apply pending migrations in filename order
4. Record each successful migration in the tracking table

## Requirements

Choose one connection path:

- `DATABASE_URL` — direct PostgreSQL connection string; recommended for local PostgreSQL or local Supabase Postgres
- `SUPABASE_URL` — your hosted Supabase project base URL (`https://<ref>.supabase.co`)
- `SUPABASE_ACCESS_TOKEN` — Supabase Management API personal access token (from https://supabase.com/dashboard/account/tokens)

## File naming

Files are named `NNN_description.sql` and applied in lexicographic order.

Latest additive bundled migrations include:

- `008_related_learnings.sql`
- `009_skill_proposal_candidates.sql`
- `010_skill_proposals.sql`
- `011_complete_feature_phase_coverage.sql`
- `012_phase_execution_attestations.sql`
- `013_phase_execution_attestations_repairs.sql`
- `014_phase_prompt_realizations.sql`
- `015_watcher_review_independence.sql`
- `016_release_lifecycle.sql`
- `017_phase_artifact_paths.sql`
