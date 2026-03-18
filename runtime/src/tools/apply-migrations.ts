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

import type { RuntimeConfig } from '../config.js';
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

function createSqlExecutor(config: RuntimeConfig): { executor?: SqlExecutor; error?: string } {
  const database_url = config.database?.url;
  if (database_url != null && database_url.length > 0) {
    return { executor: new DirectPostgresExecutor(database_url) };
  }

  const supabase_url = config.supabase?.url;
  const access_token = config.supabase?.access_token;

  if (supabase_url != null && supabase_url.length > 0 && access_token != null && access_token.length > 0) {
    const project_ref = SupabaseManagementApiExecutor.extractProjectRef(supabase_url);
    if (project_ref == null) {
      return {
        error: `Cannot extract project ref from SUPABASE_URL: ${supabase_url}. Expected format: https://<ref>.supabase.co`,
      };
    }
    return { executor: new SupabaseManagementApiExecutor(project_ref, access_token) };
  }

  return {
    error:
      'No database connection configured. Set one of:\n' +
      '  • DATABASE_URL — direct PostgreSQL connection string (works with any provider)\n' +
      '  • SUPABASE_URL + SUPABASE_ACCESS_TOKEN — Supabase Management API\n' +
      'Set in .env or .odin/config.yaml.',
  };
}

// ====================================================================
// Migration file discovery
// ====================================================================

function findMigrationsDir(): string | null {
  const project_root = process.env.ODIN_PROJECT_ROOT;
  if (project_root != null) {
    const project_migrations = join(project_root, 'migrations');
    if (existsSync(project_migrations)) {
      return project_migrations;
    }
  }

  const current_file = fileURLToPath(import.meta.url);
  const package_root = resolve(dirname(current_file), '..', '..');
  const sibling_migrations = resolve(package_root, '..', 'migrations');
  if (existsSync(sibling_migrations)) {
    return sibling_migrations;
  }

  const bundled_migrations = join(package_root, 'migrations');
  if (existsSync(bundled_migrations)) {
    return bundled_migrations;
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
 * already in place. If `agent_claims` exists, the v2 schema is also present.
 */
async function bootstrapExistingSchema(
  executor: SqlExecutor,
  migration_files: Array<{ name: string }>,
): Promise<{ bootstrapped: string[]; error?: string }> {
  const check = await executor.execute(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('features', 'agent_claims') ORDER BY tablename;`
  );
  if (check.error != null) {
    return { bootstrapped: [], error: check.error };
  }

  const existing_tables = new Set(check.rows.map((r) => r.tablename as string));
  if (existing_tables.size === 0) {
    return { bootstrapped: [] };
  }

  const has_core = existing_tables.has('features');
  const has_v2 = existing_tables.has('agent_claims');

  // Determine which migrations are already represented in the live schema.
  // Core migrations: 001-004. V2 migrations: 005-008.
  const bootstrapped: string[] = [];
  for (const file of migration_files) {
    const prefix = parseInt(file.name.split('_')[0] ?? '', 10);
    if (isNaN(prefix)) continue;

    if (has_core && prefix <= 4) {
      bootstrapped.push(file.name);
    } else if (has_v2 && prefix >= 5) {
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
        '${ODIN_PROJECT_ROOT}/migrations/, sibling migrations/ to runtime package, bundled migrations/.'
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
