/**
 * SQL Executor Adapter Interface
 * Version: 0.1.0
 */

export interface SqlQueryResult {
  rows: Array<Record<string, unknown>>;
  error?: string;
}

export interface SqlExecutor {
  /** Execute a SQL statement. Returns rows for queries, empty array for DDL/DML. */
  execute(sql: string): Promise<SqlQueryResult>;

  /** Clean up connections. */
  close(): Promise<void>;
}
