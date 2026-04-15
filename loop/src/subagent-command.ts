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

/**
 * Get the executable name from a command array.
 *
 * @param command - The command split into executable and arguments (executable expected at index 0)
 * @returns The first element of `command` if present, otherwise `'<command>'`
 */
function formatCommand(command: string[]): string {
  return command[0] ?? '<command>';
}

/**
 * Validate a raw value as one of the allowed phase outcomes.
 *
 * @param value - The value to validate
 * @returns `PhaseOutcome` if `value` is `'completed'`, `'blocked'`, or `'needs_rework'`, `null` otherwise
 */
function parseOutcome(value: unknown): PhaseOutcome | null {
  return value === 'completed' || value === 'blocked' || value === 'needs_rework' ? value : null;
}

/**
 * Parses a JSON-like value into an array of SubagentExecutionArtifact when well-formed.
 *
 * Accepts null/undefined and returns an empty array. Expects an array where each entry is an object with a non-empty `output_type` string and an optional `phase` that, when present, is a non-empty trimmed string; each artifact's `content` is preserved. If `value` is not an array or any entry is malformed, returns `null`.
 *
 * @param value - The input to parse (typically parsed JSON from a subagent executor)
 * @returns The parsed artifact list, or `null` if the input is malformed
 */
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

/**
 * Parse a potentially unknown `blockers` payload into an array of strings.
 *
 * @param value - The raw value to parse (typically a decoded JSON field)
 * @returns An empty `string[]` if `value` is `null` or `undefined`; the string array if `value` is an array consisting only of strings; otherwise `null` when `value` is not an array or contains any non-string entries
 */
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

/**
 * Parse and validate a subagent executor's JSON result from stdout.
 *
 * @param stdout - The raw stdout string produced by the subagent executor
 * @returns The validated SubagentExecutionResult containing `summary`, `outcome`, optional `next_phase`, `blockers`, and `artifacts`
 * @throws Error('Subagent executor returned invalid JSON on stdout.') if `stdout` is not valid JSON
 * @throws Error('Subagent executor returned a malformed result payload.') if the parsed value is not a non-array object
 * @throws Error('Subagent executor returned an incomplete result payload.') if required fields are missing or invalid
 */
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

/**
 * Create an Error describing a failed subagent executor invocation.
 *
 * Prefers a trimmed `stderr` message as the failure detail, falls back to a trimmed
 * `stdout` message, and otherwise uses `exit code <code|unknown>`.
 *
 * @param command - The command array used to run the subagent (executable and args)
 * @param result - Collected process result containing `code`, `stdout`, `stderr`, and `stdin_closed_early`
 * @returns An Error whose message is `Subagent executor <formatted command> failed: <detail>`
 */
function commandError(command: string[], result: CommandResult): Error {
  const stderr = result.stderr.trim();
  const stdout = result.stdout.trim();
  const detail = stderr.length > 0 ? stderr : stdout.length > 0 ? stdout : `exit code ${result.code ?? 'unknown'}`;
  return new Error(`Subagent executor ${formatCommand(command)} failed: ${detail}`);
}

/**
 * Creates a SubagentExecutor that runs the specified command as a child process to execute subagent requests.
 *
 * The returned executor writes a JSON request to the child process's stdin, captures stdout/stderr, enforces a fixed timeout,
 * requires a zero exit code, and parses/validates the child's JSON stdout into a SubagentExecutionResult.
 *
 * @param command - Array where index 0 is the executable and remaining entries are its arguments; the executable must be a non-empty string
 * @returns A SubagentExecutor whose `execute` method sends the request to the command and returns a validated SubagentExecutionResult
 * @throws Error if `command[0]` is missing or an empty string
 */
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
