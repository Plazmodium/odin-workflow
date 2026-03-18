/**
 * Supabase Management API SQL Executor
 * Version: 0.1.0
 *
 * Executes SQL via POST https://api.supabase.com/v1/projects/{ref}/database/query
 * Requires a personal access token from https://supabase.com/dashboard/account/tokens
 */

import type { SqlExecutor, SqlQueryResult } from './types.js';

export class SupabaseManagementApiExecutor implements SqlExecutor {
  private readonly project_ref: string;
  private readonly access_token: string;

  constructor(project_ref: string, access_token: string) {
    this.project_ref = project_ref;
    this.access_token = access_token;
  }

  async execute(sql: string): Promise<SqlQueryResult> {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${this.project_ref}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      return { rows: [], error: `HTTP ${response.status}: ${body}` };
    }

    const data = await response.json();
    const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
    return { rows };
  }

  async close(): Promise<void> {
    // No persistent connection to clean up.
  }

  static extractProjectRef(supabase_url: string): string | null {
    const match = supabase_url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
    return match?.[1] ?? null;
  }
}
