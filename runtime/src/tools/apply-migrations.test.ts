import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CONFIG_RESTART_NOTE, type RuntimeConfig } from '../config.js';
import type { SqlExecutor } from '../adapters/sql-executor/types.js';
import { bootstrapExistingSchema, createSqlExecutor, describeSupabaseManagementApiUrlIssue } from './apply-migrations.js';

const tools_dir = dirname(fileURLToPath(import.meta.url));
const bundled_migration_011_path = resolve(tools_dir, '../../migrations/011_complete_feature_phase_coverage.sql');
const bundled_migration_012_path = resolve(tools_dir, '../../migrations/012_phase_execution_attestations.sql');

function resolveCanonicalMigration011Path(): string {
  const candidates = [
    resolve(tools_dir, '../../../../database/supabase-migrations/011_complete_feature_phase_coverage.sql'),
    resolve(tools_dir, '../../../migrations/011_complete_feature_phase_coverage.sql'),
  ];

  const match = candidates.find((candidate) => existsSync(candidate));
  if (match == null) {
    throw new Error(`Could not find canonical migration 011 at any expected path: ${candidates.join(', ')}`);
  }

  return match;
}

function resolveCanonicalMigration012Path(): string {
  const candidates = [
    resolve(tools_dir, '../../../../database/supabase-migrations/012_phase_execution_attestations.sql'),
    resolve(tools_dir, '../../../migrations/012_phase_execution_attestations.sql'),
  ];

  const match = candidates.find((candidate) => existsSync(candidate));
  if (match == null) {
    throw new Error(`Could not find canonical migration 012 at any expected path: ${candidates.join(', ')}`);
  }

  return match;
}

function createConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    runtime: { mode: 'in_memory' },
    archive: { provider: 'none' },
    ...overrides,
  };
}

describe('describeSupabaseManagementApiUrlIssue', () => {
  it('flags storage endpoints as invalid project URLs', () => {
    const issue = describeSupabaseManagementApiUrlIssue('http://127.0.0.1:54321/storage/v1/s3');

    expect(issue).toContain('Storage endpoint');
    expect(issue).toContain('DATABASE_URL');
  });

  it('flags local Supabase URLs for management-api usage', () => {
    const issue = describeSupabaseManagementApiUrlIssue('http://127.0.0.1:54321');

    expect(issue).toContain('local Supabase endpoint');
    expect(issue).toContain('DATABASE_URL');
  });

  it('accepts hosted project base URLs', () => {
    const issue = describeSupabaseManagementApiUrlIssue('https://abc123.supabase.co');

    expect(issue).toBeNull();
  });
});

describe('createSqlExecutor', () => {
  it('includes restart guidance when no database connection is configured', () => {
    const { executor, error } = createSqlExecutor(createConfig());

    expect(executor).toBeUndefined();
    expect(error).toContain('No database connection configured');
    expect(error).toContain(CONFIG_RESTART_NOTE);
  });

  it('includes restart guidance when SUPABASE_URL points to a storage endpoint', () => {
    const { executor, error } = createSqlExecutor(
      createConfig({
        supabase: {
          url: 'http://127.0.0.1:54321/storage/v1/s3',
          access_token: 'token',
        },
      }),
    );

    expect(executor).toBeUndefined();
    expect(error).toContain('Storage endpoint');
    expect(error).toContain(CONFIG_RESTART_NOTE);
  });
});

describe('bootstrapExistingSchema', () => {
  function createExecutor(responses: Array<{ rows?: Array<Record<string, unknown>>; error?: string | null }>): SqlExecutor {
    return {
      async execute() {
        const next = responses.shift();
        if (next == null) {
          throw new Error('No mock response left');
        }

        return {
          rows: next.rows ?? [],
          error: next.error ?? undefined,
        };
      },
      async close() {},
    };
  }

  it('bootstraps migration 009 when the skill proposal table already exists', async () => {
    const executor = createExecutor([
      {
        rows: [{
          has_core: true,
          has_v2: true,
          has_skill_proposals: true,
          has_skill_proposal_workflow: true,
          has_phase_execution_attestations: true,
        }],
      },
      { rows: [] },
    ]);

    const result = await bootstrapExistingSchema(executor, [
      { name: '001_schema.sql' },
      { name: '005_odin_v2_schema.sql' },
      { name: '008_related_learnings.sql' },
      { name: '009_skill_proposal_candidates.sql' },
      { name: '010_skill_proposals.sql' },
      { name: '012_phase_execution_attestations.sql' },
    ]);

    expect(result.bootstrapped).toEqual([
      '001_schema.sql',
      '005_odin_v2_schema.sql',
      '008_related_learnings.sql',
      '009_skill_proposal_candidates.sql',
      '010_skill_proposals.sql',
      '012_phase_execution_attestations.sql',
    ]);
  });

  it('leaves repair migration 013 pending when only the attestation table exists', async () => {
    const executor = createExecutor([
      {
        rows: [{
          has_core: true,
          has_v2: true,
          has_skill_proposals: true,
          has_skill_proposal_workflow: true,
          has_phase_execution_attestations: true,
        }],
      },
      { rows: [] },
    ]);

    const result = await bootstrapExistingSchema(executor, [
      { name: '001_schema.sql' },
      { name: '005_odin_v2_schema.sql' },
      { name: '008_related_learnings.sql' },
      { name: '009_skill_proposal_candidates.sql' },
      { name: '010_skill_proposals.sql' },
      { name: '012_phase_execution_attestations.sql' },
      { name: '013_phase_execution_attestations_repairs.sql' },
    ]);

    expect(result.bootstrapped).toContain('012_phase_execution_attestations.sql');
    expect(result.bootstrapped).not.toContain('013_phase_execution_attestations_repairs.sql');
  });
});

describe('migration 011', () => {
  it('drops get_feature_status before replacing its row type and stays aligned with the canonical SQL', () => {
    const bundled_sql = readFileSync(bundled_migration_011_path, 'utf8');
    const canonical_sql = readFileSync(resolveCanonicalMigration011Path(), 'utf8');

    expect(bundled_sql).toContain('DROP FUNCTION IF EXISTS get_feature_status(TEXT);');
    expect(bundled_sql).toBe(canonical_sql);
  });
});

describe('migration 012', () => {
  it('stays aligned with the canonical SQL', () => {
    const bundled_sql = readFileSync(bundled_migration_012_path, 'utf8');
    const canonical_sql = readFileSync(resolveCanonicalMigration012Path(), 'utf8');

    expect(bundled_sql).toContain('CREATE TABLE phase_execution_attestations');
    expect(bundled_sql).toBe(canonical_sql);
  });
});

describe('migration 013', () => {
  const bundled_migration_013_path = resolve(tools_dir, '../../migrations/013_phase_execution_attestations_repairs.sql');

  function resolveCanonicalMigration013Path(): string {
    const candidates = [
      resolve(tools_dir, '../../../../database/supabase-migrations/013_phase_execution_attestations_repairs.sql'),
      resolve(tools_dir, '../../../migrations/013_phase_execution_attestations_repairs.sql'),
    ];

    const match = candidates.find((candidate) => existsSync(candidate));
    if (match == null) {
      throw new Error(`Could not find canonical migration 013 at any expected path: ${candidates.join(', ')}`);
    }

    return match;
  }

  it('stays aligned with the canonical SQL', () => {
    const bundled_sql = readFileSync(bundled_migration_013_path, 'utf8');
    const canonical_sql = readFileSync(resolveCanonicalMigration013Path(), 'utf8');

    expect(bundled_sql).toContain('CREATE TRIGGER phase_execution_attestations_updated_at_trigger');
    expect(bundled_sql).toBe(canonical_sql);
  });
});
