/**
 * TLA+ PreCheck Adapter
 * Version: 0.1.0
 */

import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

import type {
  FormalVerificationAdapter,
  InvariantViolation,
  MachineVerificationResult,
  VerifyDesignRequest,
} from './types.js';

interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeout_ms: number
): Promise<CommandResult> {
  return new Promise((resolve_promise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeout_ms,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => resolve_promise({ code, stdout, stderr }));
  });
}

function isWithinProjectRoot(project_root: string, candidate_path: string): boolean {
  const relative_path = relative(project_root, candidate_path);
  return relative_path !== '..' && !relative_path.startsWith(`..${sep}`) && relative_path !== '';
}

function truncateTrace(trace: string, max_length: number): string {
  if (trace.length <= max_length) return trace;
  return trace.slice(0, max_length - 3) + '...';
}

interface TlaPreCheckEstimate {
  tier?: string;
  totalStateCount?: string;
  withinBudget?: boolean;
  budgetViolations?: Array<{ name?: string; message?: string }>;
}

interface TlaPreCheckCertificate {
  machine?: string;
  proofPassed?: boolean;
  equivalent?: boolean | null;
  invariantsChecked?: string[];
  propertiesChecked?: string[];
  deadlockChecked?: boolean;
  tlcStateCount?: number;
  tsStateCount?: number;
  proofOutput?: string;
}

interface TlaPreCheckVerifyOutput {
  estimate?: TlaPreCheckEstimate;
  certificate?: TlaPreCheckCertificate;
}

/**
 * tla-precheck `check` writes two JSON blobs to stdout separated by a text line.
 * Extract the last valid JSON object (the verification result).
 */
export function extractLastJson(stdout: string): string | null {
  const blocks: string[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < stdout.length; i++) {
    if (stdout[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (stdout[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        blocks.push(stdout.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return blocks.at(-1) ?? null;
}

export function parseCliOutput(stdout: string, machine_path: string): MachineVerificationResult {
  const json_block = extractLastJson(stdout);
  if (json_block == null) {
    throw new Error('No JSON object found in tla-precheck output');
  }

  const raw = JSON.parse(json_block) as Record<string, unknown>;

  // The last JSON block can be either:
  // 1. A TlaPreCheckVerifyOutput with { estimate, certificate, generated }
  // 2. A raw TlaPreCheckEstimate (when budget check fails, only the estimate is emitted)
  const is_verify_output = 'certificate' in raw || ('estimate' in raw && 'generated' in raw);
  const parsed = (is_verify_output ? raw : { estimate: raw }) as TlaPreCheckVerifyOutput;
  const cert = parsed.certificate;
  const estimate = parsed.estimate;

  if (cert == null && estimate != null && estimate.withinBudget === false) {
    const violation_names = (estimate.budgetViolations ?? [])
      .map((v) => v.name ?? 'unknown')
      .join(', ');
    return {
      machine_name: machine_path,
      status: 'VIOLATION',
      proof_passed: false,
      equivalent: null,
      states_checked: 0,
      invariant_violations: [{
        invariant_name: 'budget',
        description: `State space exceeds budget. Violations: ${violation_names}`,
      }],
      error: 'Estimate failed: state space exceeds budget.',
      duration_ms: 0,
    };
  }

  if (cert == null) {
    throw new Error('No certificate found in tla-precheck output');
  }

  const machine_name = cert.machine ?? machine_path;
  const proof_passed = cert.proofPassed === true;

  let status: MachineVerificationResult['status'];
  if (proof_passed && (cert.equivalent === true || cert.equivalent == null)) {
    status = 'VERIFIED';
  } else {
    status = 'VIOLATION';
  }

  const violations: InvariantViolation[] = [];
  if (!proof_passed && cert.proofOutput != null) {
    violations.push({
      invariant_name: 'proof',
      description: 'TLC proof failed',
      counter_example_summary: truncateTrace(cert.proofOutput, 500),
    });
  }

  return {
    machine_name,
    status,
    proof_passed,
    equivalent: cert.equivalent ?? null,
    states_checked: cert.tlcStateCount ?? 0,
    invariant_violations: violations,
    duration_ms: 0,
  };
}

export class TlaPreCheckAdapter implements FormalVerificationAdapter {
  private readonly project_root: string;
  private readonly timeout_ms: number;
  private readonly trace_dir: string;

  constructor(project_root: string, timeout_seconds: number = 120) {
    this.project_root = project_root;
    this.timeout_ms = timeout_seconds * 1000;
    this.trace_dir = join(tmpdir(), 'odin-tla-traces');
  }

  async isAvailable(): Promise<boolean> {
    const binary_path = this.resolveBinaryPath();
    try {
      await access(binary_path, fsConstants.X_OK);
    } catch {
      return false;
    }

    try {
      const result = await runCommand('java', ['-version'], this.project_root, 10_000);
      if (result.code !== 0) return false;

      const version_output = result.stderr + result.stdout;
      const match = version_output.match(/version "(\d+)/);
      const version_str = match?.[1];
      if (version_str == null) return false;
      return parseInt(version_str, 10) >= 17;
    } catch {
      return false;
    }
  }

  async verifyDesign(request: VerifyDesignRequest): Promise<MachineVerificationResult> {
    const absolute_path = resolve(this.project_root, request.machine_path);
    if (!isWithinProjectRoot(this.project_root, absolute_path)) {
      return {
        machine_name: request.machine_path,
        status: 'INTERNAL_ERROR',
        proof_passed: false,
        equivalent: null,
        states_checked: 0,
        invariant_violations: [],
        error: `Path traversal rejected: ${request.machine_path} is outside the project root.`,
        duration_ms: 0,
      };
    }

    try {
      await access(absolute_path, fsConstants.R_OK);
    } catch {
      return {
        machine_name: request.machine_path,
        status: 'INVALID_MODEL',
        proof_passed: false,
        equivalent: null,
        states_checked: 0,
        invariant_violations: [],
        error: `Machine file not found: ${request.machine_path}`,
        duration_ms: 0,
      };
    }

    const binary_path = this.resolveBinaryPath();
    const start = Date.now();

    let result: CommandResult;
    try {
      result = await runCommand(
        binary_path,
        ['check', absolute_path, '--json'],
        this.project_root,
        this.timeout_ms
      );
    } catch (error) {
      const elapsed = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('TIMEOUT') || message.includes('timed out')) {
        return {
          machine_name: request.machine_path,
          status: 'TIMEOUT',
          proof_passed: false,
          equivalent: null,
          states_checked: 0,
          invariant_violations: [],
          error: `TLC exceeded time budget (${this.timeout_ms / 1000}s).`,
          duration_ms: elapsed,
        };
      }

      return {
        machine_name: request.machine_path,
        status: 'INTERNAL_ERROR',
        proof_passed: false,
        equivalent: null,
        states_checked: 0,
        invariant_violations: [],
        error: `tla-precheck execution failed: ${message}`,
        duration_ms: elapsed,
      };
    }

    const elapsed = Date.now() - start;

    if (result.stdout.trim().length === 0) {
      return {
        machine_name: request.machine_path,
        status: 'INTERNAL_ERROR',
        proof_passed: false,
        equivalent: null,
        states_checked: 0,
        invariant_violations: [],
        error: `tla-precheck produced no output. stderr: ${result.stderr}`,
        duration_ms: elapsed,
      };
    }

    let verification: MachineVerificationResult;
    try {
      verification = parseCliOutput(result.stdout, request.machine_path);
    } catch {
      return {
        machine_name: request.machine_path,
        status: 'INVALID_MODEL',
        proof_passed: false,
        equivalent: null,
        states_checked: 0,
        invariant_violations: [],
        error: `Failed to parse tla-precheck output. Raw: ${result.stdout.slice(0, 300)}`,
        duration_ms: elapsed,
      };
    }

    verification.duration_ms = elapsed;

    if (result.stderr.trim().length > 0 && verification.status === 'VIOLATION') {
      const date_stamp = new Date().toISOString().slice(0, 10);
      await this.writeTraceLogs(verification.machine_name, result.stderr);
      for (const violation of verification.invariant_violations) {
        violation.trace_path = join(this.trace_dir, `${verification.machine_name}-${date_stamp}.log`);
      }
    }

    return verification;
  }

  private resolveBinaryPath(): string {
    return join(this.project_root, 'node_modules', '.bin', 'tla-precheck');
  }

  private async writeTraceLogs(machine_name: string, trace: string): Promise<void> {
    try {
      await mkdir(this.trace_dir, { recursive: true });
      const filename = `${machine_name}-${new Date().toISOString().slice(0, 10)}.log`;
      await writeFile(join(this.trace_dir, filename), trace, 'utf8');
    } catch {
      console.error(`[Odin Runtime] Failed to write trace log for ${machine_name}`);
    }
  }
}
