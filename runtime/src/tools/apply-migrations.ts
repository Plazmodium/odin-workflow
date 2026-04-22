/**
 * Apply Migrations Tool
 * Version: 0.2.0
 *
 * Provider-agnostic PostgreSQL migration runner. Supports:
 *   - Supabase Management API (SUPABASE_URL + SUPABASE_ACCESS_TOKEN)
 *   - Direct PostgreSQL (DATABASE_URL)
 *
 * Includes automatic bootstrap: detects existing Odin schema and seeds
 * the tracking table so already-applied migrations are not re-run.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG_RESTART_NOTE, type RuntimeConfig } from '../config.js';
import type { ApplyMigrationsInput } from '../schemas.js';
import type { SqlExecutor } from '../adapters/sql-executor/types.js';
import { SupabaseManagementApiExecutor } from '../adapters/sql-executor/supabase-management-api.js';
import { DirectPostgresExecutor } from '../adapters/sql-executor/direct-postgres.js';
import { createErrorResult, createTextResult } from '../utils.js';

interface MigrationResult {
  name: string;
  status: 'applied' | 'skipped' | 'failed';
  error?: string;
}

// ====================================================================
// Executor factory
// ====================================================================

function appendRestartNote(message: string): string {
  return `${message}\n\n${CONFIG_RESTART_NOTE}`;
}

export function describeSupabaseManagementApiUrlIssue(supabase_url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(supabase_url);
  } catch {
    return `SUPABASE_URL is not a valid URL: ${supabase_url}. Use your project base URL (for example https://<ref>.supabase.co) or use DATABASE_URL for direct PostgreSQL migrations.`;
  }

  if (parsed.pathname.startsWith('/storage/')) {
    return `SUPABASE_URL points to a Storage endpoint (${supabase_url}), not a project base URL. Use the project base URL instead (for example https://<ref>.supabase.co). If you are working against local Supabase or another local PostgreSQL instance, prefer DATABASE_URL for odin.apply_migrations.`;
  }

  if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
    return `SUPABASE_URL points to a local Supabase endpoint (${supabase_url}). Odin does not use local Supabase URLs with the Supabase Management API path here. Use DATABASE_URL for direct PostgreSQL migrations instead.`;
  }

  const project_ref = SupabaseManagementApiExecutor.extractProjectRef(supabase_url);
  if (project_ref == null) {
    return `Cannot extract a Supabase project ref from SUPABASE_URL: ${supabase_url}. Expected a base project URL like https://<ref>.supabase.co. If you are not using hosted Supabase Management API access, use DATABASE_URL instead.`;
  }

  return null;
}

export function createSqlExecutor(config: RuntimeConfig): { executor?: SqlExecutor; error?: string } {
  const database_url = config.database?.url;
  if (database_url != null && database_url.length > 0) {
    return { executor: new DirectPostgresExecutor(database_url) };
  }

  const supabase_url = config.supabase?.url;
  const access_token = config.supabase?.access_token;

  if (supabase_url != null && supabase_url.length > 0 && access_token != null && access_token.length > 0) {
    const url_issue = describeSupabaseManagementApiUrlIssue(supabase_url);
    if (url_issue != null) {
      return {
        error: appendRestartNote(url_issue),
      };
    }

    const project_ref = SupabaseManagementApiExecutor.extractProjectRef(supabase_url);
    if (project_ref == null) {
      return {
        error: appendRestartNote(
          `Cannot extract project ref from SUPABASE_URL: ${supabase_url}. Expected format: https://<ref>.supabase.co`,
        ),
      };
    }
    return { executor: new SupabaseManagementApiExecutor(project_ref, access_token) };
  }

  return {
    error: appendRestartNote(
      'No database connection configured. Set one of:\n' +
      '  • DATABASE_URL — direct PostgreSQL connection string (recommended for local PostgreSQL or local Supabase)\n' +
      '  • SUPABASE_URL + SUPABASE_ACCESS_TOKEN — Supabase Management API\n' +
      'Set in .env or .odin/config.yaml.',
    ),
  };
}

// ====================================================================
// Migration file discovery
// ====================================================================

function findMigrationsDir(): string | null {
  const current_file = fileURLToPath(import.meta.url);
  const package_root = resolve(dirname(current_file), '..', '..');

  const bundled_migrations = join(package_root, 'migrations');
  if (existsSync(bundled_migrations)) {
    return bundled_migrations;
  }

  const sibling_migrations = resolve(package_root, '..', 'migrations');
  if (existsSync(sibling_migrations)) {
    return sibling_migrations;
  }

  return null;
}

function loadMigrationFiles(migrations_dir: string): Array<{ name: string; sql: string }> {
  const entries = readdirSync(migrations_dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return entries.map((name) => ({
    name,
    sql: readFileSync(join(migrations_dir, name), 'utf8'),
  }));
}

// ====================================================================
// Tracking table + bootstrap
// ====================================================================

async function ensureTrackingTable(executor: SqlExecutor): Promise<{ error?: string }> {
  const result = await executor.execute(
    `CREATE TABLE IF NOT EXISTS odin_migrations (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT now()
);`
  );
  return { error: result.error };
}

async function fetchAppliedNames(executor: SqlExecutor): Promise<{ names: Set<string>; error?: string }> {
  const result = await executor.execute('SELECT name FROM odin_migrations ORDER BY id;');
  if (result.error != null) {
    return { names: new Set(), error: result.error };
  }
  const names = new Set(result.rows.map((row) => row.name as string));
  return { names };
}

/**
 * Bootstrap: detect whether the Odin schema already exists and seed the
 * tracking table with migration names so they are not re-applied.
 *
 * Detection heuristic: if the `features` table exists, the core schema is
 * already in place. If `agent_claims` exists, the current bundled v2 baseline
 * (`005`-`008`) is also present. If `skill_proposal_candidates` exists,
 * migration `009` is already present too. If `skill_proposals` exists,
 * migration `010` is already present too. If `phase_execution_attestations`
 * exists, migration `012` is already present too. Follow-up repair migration
 * `013` remains intentionally additive and idempotent.
 */
export async function bootstrapExistingSchema(
  executor: SqlExecutor,
  migration_files: Array<{ name: string }>,
): Promise<{ bootstrapped: string[]; error?: string }> {
  const check = await executor.execute(`
SELECT
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'features') AS has_core,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agent_claims') AS has_v2,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'skill_proposal_candidates') AS has_skill_proposals,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'skill_proposals') AS has_skill_proposal_workflow,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'phase_execution_attestations') AS has_phase_execution_attestations;
  `);
  if (check.error != null) {
    return { bootstrapped: [], error: check.error };
  }

  const row = check.rows[0] as Record<string, unknown> | undefined;
  if (row == null) {
    return { bootstrapped: [] };
  }

  const asBoolean = (value: unknown): boolean => value === true || value === 't';

  const has_core = asBoolean(row.has_core);
  const has_v2 = asBoolean(row.has_v2);
  const has_skill_proposals = asBoolean(row.has_skill_proposals);
  const has_skill_proposal_workflow = asBoolean(row.has_skill_proposal_workflow);
  const has_phase_execution_attestations = asBoolean(row.has_phase_execution_attestations);

  // Determine which migrations are already represented in the live schema.
  // Core migrations: 001-004. Current bundled v2 baseline: 005-008. Skill proposal storage: 009. Workflow state: 010. Execution attestation storage: 012. Repair wave: 013.
  const bootstrapped: string[] = [];
  for (const file of migration_files) {
    const prefix = parseInt(file.name.split('_')[0] ?? '', 10);
    if (isNaN(prefix)) continue;

    if (has_core && prefix <= 4) {
      bootstrapped.push(file.name);
    } else if (has_v2 && prefix >= 5 && prefix <= 8) {
      bootstrapped.push(file.name);
    } else if (has_skill_proposals && prefix === 9) {
      bootstrapped.push(file.name);
    } else if (has_skill_proposal_workflow && prefix === 10) {
      bootstrapped.push(file.name);
    } else if (has_phase_execution_attestations && prefix === 12) {
      bootstrapped.push(file.name);
    }
  }

  if (bootstrapped.length === 0) {
    return { bootstrapped: [] };
  }

  // Seed the tracking table.
  const values = bootstrapped
    .map((name) => `('${name.replace(/'/g, "''")}')`)
    .join(', ');

  const seed = await executor.execute(
    `INSERT INTO odin_migrations (name) VALUES ${values} ON CONFLICT (name) DO NOTHING;`
  );
  if (seed.error != null) {
    return { bootstrapped: [], error: `Bootstrap seed failed: ${seed.error}` };
  }

  console.error(
    `[Odin Runtime] Bootstrapped ${bootstrapped.length} existing migration(s): ${bootstrapped.join(', ')}`
  );

  return { bootstrapped };
}

// ====================================================================
// Main handler
// ====================================================================

export async function handleApplyMigrations(
  config: RuntimeConfig,
  input: ApplyMigrationsInput
) {
  const migrations_dir = findMigrationsDir();
  if (migrations_dir == null) {
    return createErrorResult(
      'No migrations directory found. Looked for: ' +
        'bundled migrations/ in the Odin package, sibling migrations/ next to the runtime package.'
    );
  }

  const migration_files = loadMigrationFiles(migrations_dir);
  if (migration_files.length === 0) {
    return createTextResult('No .sql migration files found in ' + migrations_dir, {
      migrations_dir,
      total: 0,
      applied: [],
      skipped: [],
      failed: [],
    });
  }

  if (input.dry_run) {
    const file_names = migration_files.map((f) => f.name);
    return createTextResult(
      `Dry run: found ${migration_files.length} migration file(s) in ${migrations_dir}.\n` +
        `Files: ${file_names.join(', ')}\n` +
        'Run with dry_run=false to apply pending migrations.',
      {
        dry_run: true,
        migrations_dir,
        total: migration_files.length,
        files: file_names,
      }
    );
  }

  // Resolve executor (DATABASE_URL takes priority over Supabase Management API).
  const { executor, error: executor_error } = createSqlExecutor(config);
  if (executor == null) {
    return createErrorResult(executor_error!);
  }

  try {
    return await runMigrations(executor, migration_files, migrations_dir);
  } finally {
    await executor.close();
  }
}

async function runMigrations(
  executor: SqlExecutor,
  migration_files: Array<{ name: string; sql: string }>,
  migrations_dir: string,
) {
  // Ensure the tracking table exists.
  const tracking_result = await ensureTrackingTable(executor);
  if (tracking_result.error != null) {
    return createErrorResult(
      `Failed to create migration tracking table: ${tracking_result.error}`
    );
  }

  // Check which migrations are already recorded.
  let { names: applied_names, error: fetch_error } = await fetchAppliedNames(executor);
  if (fetch_error != null) {
    return createErrorResult(`Failed to query applied migrations: ${fetch_error}`);
  }

  // Bootstrap: if no migrations are tracked yet, check for existing schema.
  if (applied_names.size === 0) {
    const { bootstrapped, error: bootstrap_error } = await bootstrapExistingSchema(
      executor,
      migration_files,
    );
    if (bootstrap_error != null) {
      return createErrorResult(`Bootstrap failed: ${bootstrap_error}`);
    }
    if (bootstrapped.length > 0) {
      for (const name of bootstrapped) {
        applied_names.add(name);
      }
    }
  }

  // Apply pending migrations.
  const results: MigrationResult[] = [];
  let had_failure = false;

  for (const migration of migration_files) {
    if (applied_names.has(migration.name)) {
      results.push({ name: migration.name, status: 'skipped' });
      continue;
    }

    if (had_failure) {
      results.push({
        name: migration.name,
        status: 'failed',
        error: 'Skipped due to earlier failure',
      });
      continue;
    }

    console.error(`[Odin Runtime] Applying migration: ${migration.name}`);
    const apply_result = await executor.execute(migration.sql);
    if (apply_result.error != null) {
      results.push({ name: migration.name, status: 'failed', error: apply_result.error });
      had_failure = true;
      continue;
    }

    const record_result = await executor.execute(
      `INSERT INTO odin_migrations (name) VALUES ('${migration.name.replace(/'/g, "''")}');`
    );
    if (record_result.error != null) {
      results.push({
        name: migration.name,
        status: 'failed',
        error: `Migration SQL succeeded but tracking insert failed: ${record_result.error}`,
      });
      had_failure = true;
      continue;
    }

    results.push({ name: migration.name, status: 'applied' });
  }

  const applied = results.filter((r) => r.status === 'applied');
  const skipped = results.filter((r) => r.status === 'skipped');
  const failed = results.filter((r) => r.status === 'failed');

  const summary_lines = [
    `Migrations: ${applied.length} applied, ${skipped.length} skipped, ${failed.length} failed.`,
  ];

  if (applied.length > 0) {
    summary_lines.push(`Applied: ${applied.map((r) => r.name).join(', ')}`);
  }
  if (failed.length > 0) {
    summary_lines.push(
      `Failed: ${failed.map((r) => `${r.name} (${r.error ?? 'unknown error'})`).join(', ')}`
    );
  }

  const result_tool = had_failure ? createErrorResult : createTextResult;
  return result_tool(summary_lines.join('\n'), {
    migrations_dir,
    total: migration_files.length,
    applied: applied.map((r) => r.name),
    skipped: skipped.map((r) => r.name),
    failed: failed.map((r) => ({ name: r.name, error: r.error })),
  });
}
