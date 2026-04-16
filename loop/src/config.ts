import { resolve } from 'node:path';

import type { RalphLoopConfig } from './types.js';

/**
 * Parse a string into a strictly positive number, using a fallback when the input is missing or empty.
 *
 * @param value - The string to parse; may be `undefined` or empty (after trimming).
 * @param fallback - The number to return when `value` is `undefined` or empty.
 * @returns The parsed number greater than zero, or `fallback` if `value` is missing or empty.
 * @throws Error when `value` is present but does not parse to a finite number greater than zero.
 */
function parseNumber(value: string | undefined, fallback: number): number {
  if (value == null || value.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  return parsed;
}

/**
 * Parses a JSON string expected to be a non-empty array of command argument strings and returns it as an array of trimmed, non-empty strings.
 *
 * @param value - The JSON-encoded value to parse; if `undefined`, `null`, or empty after trimming, this function returns `null`.
 * @returns The parsed array of command arguments, or `null` when `value` is empty or missing.
 * @throws Error('Invalid subagent command JSON. Expected a JSON array of command arguments.') when `value` is not valid JSON.
 * @throws Error('Invalid subagent command JSON. Expected a non-empty JSON array of strings.') when the parsed value is not a non-empty array.
 * @throws Error('Invalid subagent command JSON. Every command element must be a non-empty string.') when any array element is not a non-empty string after trimming.
 */
function parseCommandJson(value: string | undefined): string[] | null {
  if (value == null || value.trim().length === 0) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Invalid subagent command JSON. Expected a JSON array of command arguments.');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Invalid subagent command JSON. Expected a non-empty JSON array of strings.');
  }

  const command = parsed.flatMap((entry) => (typeof entry === 'string' && entry.trim().length > 0 ? [entry] : []));
  if (command.length !== parsed.length) {
    throw new Error('Invalid subagent command JSON. Every command element must be a non-empty string.');
  }

  return command;
}

/**
 * Build runtime configuration from command-line arguments and environment variables.
 *
 * Parses CLI options in `argv` (expects `--key value` or `--flag`) and environment variables to produce a complete `RalphLoopConfig` with sensible defaults.
 *
 * @param argv - Array of command-line arguments (e.g., `process.argv.slice(2)`)
 * @param env - Environment variables object; defaults to `process.env`
 * @returns The assembled configuration:
 * - `project_root`: absolute path to the project root (from `--project-root`, `ODIN_PROJECT_ROOT`, or `process.cwd()`)
 * - `supervisor_name`: supervisor name (from `--supervisor-name`, `RALPH_LOOP_NAME`, or `'ralph-loop'`)
 * - `interval_ms`: positive interval in milliseconds (from `--interval-ms`, `RALPH_LOOP_INTERVAL_MS`, or `30000`)
 * - `subagent_command`: parsed command array (from `--subagent-command-json` or `RALPH_SUBAGENT_COMMAND_JSON`) or `null`
 */
export function loadConfig(argv: string[], env: NodeJS.ProcessEnv = process.env): RalphLoopConfig {
  const options = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg == null) {
      continue;
    }

    if (!arg.startsWith('--')) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next == null || next.startsWith('--')) {
      options.set(key, 'true');
      continue;
    }

    options.set(key, next);
    index += 1;
  }

  const project_root = resolve(options.get('project-root') ?? env.ODIN_PROJECT_ROOT ?? process.cwd());
  const supervisor_name = options.get('supervisor-name') ?? env.RALPH_LOOP_NAME ?? 'ralph-loop';
  const interval_ms = parseNumber(options.get('interval-ms') ?? env.RALPH_LOOP_INTERVAL_MS, 30000);
  const subagent_command = parseCommandJson(options.get('subagent-command-json') ?? env.RALPH_SUBAGENT_COMMAND_JSON);

  return {
    project_root,
    supervisor_name,
    interval_ms,
    subagent_command,
  };
}
