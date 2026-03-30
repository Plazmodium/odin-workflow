import { describe, expect, it } from 'vitest';

import { CONFIG_RESTART_NOTE, type RuntimeConfig } from '../config.js';
import { createSqlExecutor, describeSupabaseManagementApiUrlIssue } from './apply-migrations.js';

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
