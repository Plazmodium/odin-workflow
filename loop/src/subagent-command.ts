import { spawn } from 'node:child_process';

import type { PhaseOutcome, SubagentExecutionArtifact, SubagentExecutionRequest, SubagentExecutionResult, SubagentExecutor } from './types.js';

interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

const SUBAGENT_EXECUTOR_TIMEOUT_MS = 120_000;

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
        let settled = false;

        const cleanup = (timeout: ReturnType<typeof setTimeout>) => {
          clearTimeout(timeout);
          child.stdout.off('data', onStdout);
          child.stderr.off('data', onStderr);
          child.stdin.off('error', onStdinError);
          child.off('error', onError);
          child.off('close', onClose);
        };

        const settle = (timeout: ReturnType<typeof setTimeout>, cb: () => void) => {
          if (settled) {
            return;
          }

          settled = true;
          cleanup(timeout);
          cb();
        };

        const onStdout = (chunk: Buffer | string) => {
          stdout += String(chunk);
        };

        const onStderr = (chunk: Buffer | string) => {
          stderr += String(chunk);
        };

        const onStdinError = (error: Error & { code?: string }) => {
          if (error.code === 'EPIPE') {
            return;
          }

          settle(timeout, () => reject(error));
        };

        const onError = (error: Error) => {
          settle(timeout, () => reject(error));
        };

        const onClose = (code: number | null) => {
          settle(timeout, () => resolve({ code, stdout, stderr }));
        };

        const timeout = setTimeout(() => {
          settle(timeout, () => {
            child.kill();
            reject(new Error(`Subagent executor ${command.join(' ')} timed out after ${SUBAGENT_EXECUTOR_TIMEOUT_MS}ms.`));
          });
        }, SUBAGENT_EXECUTOR_TIMEOUT_MS);

        child.stdout.on('data', onStdout);
        child.stderr.on('data', onStderr);
        child.stdin.on('error', onStdinError);
        child.on('error', onError);
        child.on('close', onClose);

        try {
          child.stdin.write(JSON.stringify({
            schema_version: '1',
            request,
          }));
          child.stdin.end();
        } catch (error) {
          settle(timeout, () => reject(error));
        }
      });

      if (result.code !== 0) {
        throw commandError(command, result);
      }

      return parseResult(result.stdout);
    },
  };
}
