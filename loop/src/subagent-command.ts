import { spawn } from 'node:child_process';

import type { PhaseOutcome, SubagentExecutionArtifact, SubagentExecutionRequest, SubagentExecutionResult, SubagentExecutor } from './types.js';

interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
  stdin_closed_early: boolean;
}

const SUBAGENT_EXECUTOR_TIMEOUT_MS = 120_000;
const SUBAGENT_EXECUTOR_MAX_OUTPUT_BYTES = 1_000_000;

function formatCommand(command: string[]): string {
  return command[0] ?? '<command>';
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

    const record = entry as Record<string, unknown>;
    const output_type =
      typeof record.output_type === 'string' && record.output_type.trim().length > 0
        ? record.output_type.trim()
        : null;
    const phase =
      record.phase == null
        ? undefined
        : typeof record.phase === 'string' && record.phase.trim().length > 0
          ? record.phase.trim()
          : null;
    const has_content = Object.prototype.hasOwnProperty.call(record, 'content') && record.content != null;
    if (output_type == null || phase === null || !has_content) {
      return [];
    }

    return [{
      phase,
      output_type,
      content: record.content,
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
  const next_phase =
    record.next_phase == null
      ? undefined
      : typeof record.next_phase === 'string' && record.next_phase.trim().length > 0
        ? record.next_phase.trim()
        : null;
  const blockers = parseBlockers(record.blockers);
  const artifacts = parseArtifacts(record.artifacts);

  if (summary == null || summary.trim().length === 0 || outcome == null || next_phase === null || blockers == null || artifacts == null) {
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
  return new Error(`Subagent executor ${formatCommand(command)} failed: ${detail}`);
}

export function createCommandSubagentExecutor(command: string[]): SubagentExecutor {
  const executable = command[0];
  if (executable == null || executable.trim().length === 0) {
    throw new Error('Subagent executor command must be a non-empty array with a valid executable.');
  }

  return {
    async execute(request: SubagentExecutionRequest): Promise<SubagentExecutionResult> {
      const child = spawn(executable, command.slice(1), {
        cwd: request.project_root,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const result = await new Promise<CommandResult>((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        let output_bytes = 0;
        let settled = false;
        let stdin_closed_early = false;

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

        const appendOutput = (chunk: Buffer | string, sink: 'stdout' | 'stderr') => {
          const chunk_bytes = Buffer.isBuffer(chunk) ? chunk.byteLength : Buffer.byteLength(chunk);
          if (output_bytes + chunk_bytes > SUBAGENT_EXECUTOR_MAX_OUTPUT_BYTES) {
            settle(timeout, () => {
              child.stdout.destroy();
              child.stderr.destroy();
              child.kill();
              reject(
                new Error(
                  `Subagent executor ${formatCommand(command)} output exceeded ${SUBAGENT_EXECUTOR_MAX_OUTPUT_BYTES} bytes.`
                )
              );
            });
            return;
          }

          output_bytes += chunk_bytes;
          const text = String(chunk);
          if (sink === 'stdout') {
            stdout += text;
            return;
          }

          stderr += text;
        };

        const onStdout = (chunk: Buffer | string) => {
          appendOutput(chunk, 'stdout');
        };

        const onStderr = (chunk: Buffer | string) => {
          appendOutput(chunk, 'stderr');
        };

        const onStdinError = (error: Error & { code?: string }) => {
          if (error.code === 'EPIPE') {
            stdin_closed_early = true;
            return;
          }

          settle(timeout, () => reject(error));
        };

        const onError = (error: Error) => {
          settle(timeout, () => reject(error));
        };

        const onClose = (code: number | null) => {
          settle(timeout, () => resolve({ code, stdout, stderr, stdin_closed_early }));
        };

        const timeout = setTimeout(() => {
          settle(timeout, () => {
            child.stdout.destroy();
            child.stderr.destroy();
            child.kill();
            reject(new Error(`Subagent executor ${formatCommand(command)} timed out after ${SUBAGENT_EXECUTOR_TIMEOUT_MS}ms.`));
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

      if (result.stdout.trim().length === 0 && result.stderr.trim().length === 0) {
        throw new Error(
          result.stdin_closed_early
            ? `Subagent executor ${formatCommand(command)} closed stdin before consuming the request.`
            : `Subagent executor ${formatCommand(command)} produced no stdout result.`
        );
      }

      return parseResult(result.stdout);
    },
  };
}
