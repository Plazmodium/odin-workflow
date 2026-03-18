# Odin Schema Migrations

These SQL migration files define the Odin database schema for Supabase. They are applied sequentially by the `odin.apply_migrations` tool using the Supabase Management API.

## Usage

The `odin.apply_migrations` tool will:
1. Create an `odin_migrations` tracking table (if it doesn't exist)
2. Check which migrations have already been applied
3. Apply pending migrations in filename order
4. Record each successful migration in the tracking table

## Requirements

- `SUPABASE_URL` — Your Supabase project URL
- `SUPABASE_ACCESS_TOKEN` — A Supabase Management API personal access token (from https://supabase.com/dashboard/account/tokens)

## File naming

Files are named `NNN_description.sql` and applied in lexicographic order.
