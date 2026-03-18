/**
 * Direct PostgreSQL SQL Executor
 * Version: 0.1.0
 *
 * Connects via a standard DATABASE_URL connection string using postgres.js.
 * Works with any PostgreSQL provider (Neon, Railway, self-hosted, etc.).
 */

import postgres from 'postgres';

import type { SqlExecutor, SqlQueryResult } from './types.js';

export class DirectPostgresExecutor implements SqlExecutor {
  private readonly sql: postgres.Sql;

  constructor(database_url: string) {
    this.sql = postgres(database_url, {
      max: 1,
      idle_timeout: 10,
      connect_timeout: 15,
    });
  }

  async execute(query: string): Promise<SqlQueryResult> {
    try {
      const result = await this.sql.unsafe(query);
      const rows = result.map((row) => ({ ...row }) as Record<string, unknown>);
      return { rows };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { rows: [], error: message };
    }
  }

  async close(): Promise<void> {
    await this.sql.end();
  }
}
