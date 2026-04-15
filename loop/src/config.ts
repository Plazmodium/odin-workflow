import { resolve } from 'node:path';

import type { RalphLoopConfig } from './types.js';

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
