import { spawn } from 'node:child_process';

import type { PhaseOutcome, SubagentExecutionArtifact, SubagentExecutionRequest, SubagentExecutionResult, SubagentExecutor } from './types.js';

interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function parseOutcome(value: unknown): PhaseOutcome | null {
  return value === 'completed' || value === 'blocked' || value === 'needs_rework' ? value : null;
}

function parseArtifacts(value: unknown): SubagentExecutionArtifact[] | null {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry == null || Array.isArray(entry)) {
      return [];
    }

    const output_type = typeof entry.output_type === 'string' ? entry.output_type : null;
    const phase = typeof entry.phase === 'string' ? entry.phase : undefined;
    if (output_type == null || output_type.trim().length === 0) {
      return [];
    }

    return [{
      phase,
      output_type,
      content: entry.content,
    }];
  });
  return parsed.length === value.length ? parsed : null;
}

function parseBlockers(value: unknown): string[] | null {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const blockers = value.flatMap((entry) => (typeof entry === 'string' ? [entry] : []));
  return blockers.length === value.length ? blockers : null;
}

function parseResult(stdout: string): SubagentExecutionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error('Subagent executor returned invalid JSON on stdout.');
  }

  if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) {
    throw new Error('Subagent executor returned a malformed result payload.');
  }

  const record = parsed as Record<string, unknown>;

  const summary = typeof record.summary === 'string' ? record.summary : null;
  const outcome = parseOutcome(record.outcome);
  const next_phase = typeof record.next_phase === 'string' ? record.next_phase : undefined;
  const blockers = parseBlockers(record.blockers);
  const artifacts = parseArtifacts(record.artifacts);

  if (summary == null || summary.trim().length === 0 || outcome == null || blockers == null || artifacts == null) {
    throw new Error('Subagent executor returned an incomplete result payload.');
  }

  return {
    summary,
    outcome,
    next_phase,
    blockers,
    artifacts,
  };
}

function commandError(command: string[], result: CommandResult): Error {
  const stderr = result.stderr.trim();
  const stdout = result.stdout.trim();
  const detail = stderr.length > 0 ? stderr : stdout.length > 0 ? stdout : `exit code ${result.code ?? 'unknown'}`;
  return new Error(`Subagent executor ${command.join(' ')} failed: ${detail}`);
}

export function createCommandSubagentExecutor(command: string[]): SubagentExecutor {
  return {
    async execute(request: SubagentExecutionRequest): Promise<SubagentExecutionResult> {
      const child = spawn(command[0] ?? '', command.slice(1), {
        cwd: request.project_root,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const result = await new Promise<CommandResult>((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
          stdout += String(chunk);
        });

        child.stderr.on('data', (chunk) => {
          stderr += String(chunk);
        });

        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stdout, stderr }));

        child.stdin.write(JSON.stringify({
          schema_version: '1',
          request,
        }));
        child.stdin.end();
      });

      if (result.code !== 0) {
        throw commandError(command, result);
      }

      return parseResult(result.stdout);
    },
  };
}
