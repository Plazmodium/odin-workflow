# Odin Schema Migrations

These SQL migration files define the Odin database schema. They are applied sequentially by the `odin.apply_migrations` tool using either direct PostgreSQL (`DATABASE_URL`) or the Supabase Management API (`SUPABASE_URL` + `SUPABASE_ACCESS_TOKEN`).

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
