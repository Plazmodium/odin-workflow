/**
 * Semgrep Review Adapter
 * Version: 0.1.0
 */

import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, relative, resolve, sep } from 'node:path';

import type { ReviewExecutionResult, ReviewFinding } from '../../types.js';
import type { ReviewAdapter, RunReviewRequest } from './types.js';

interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runCommand(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
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
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function summarizeFindings(findings: ReviewFinding[]): string {
  if (findings.length === 0) {
    return 'Semgrep completed with 0 findings.';
  }

  const severityCounts = findings.reduce<Record<string, number>>((counts, finding) => {
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
    return counts;
  }, {});

  const orderedSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  const parts = orderedSeverities
    .filter((severity) => severityCounts[severity] != null)
    .map((severity) => `${severity}: ${severityCounts[severity]}`);

  return `Semgrep found ${findings.length} issue(s) (${parts.join(', ')}).`;
}

function parseSemgrepJson(stdout: string, changed_files: string[]): ReviewExecutionResult {
  const parsed = JSON.parse(stdout) as {
    results?: Array<{
      check_id?: string;
      path?: string;
      start?: { line?: number };
      extra?: {
        message?: string;
        severity?: string;
      };
    }>;
    errors?: Array<{ message?: string }>;
  };

  const findings: ReviewFinding[] = (parsed.results ?? []).map((result) => ({
    severity: ((result.extra?.severity ?? 'INFO').toUpperCase() as ReviewFinding['severity']),
    rule_id: result.check_id ?? null,
    file_path: result.path ?? null,
    line_number: result.start?.line ?? null,
    message: result.extra?.message ?? 'Semgrep finding',
  }));

  const hasBlocking = findings.some(
    (finding) => finding.severity === 'HIGH' || finding.severity === 'CRITICAL'
  );

  const summary = summarizeFindings(findings);

  if ((parsed.errors ?? []).length > 0) {
    const errorMessages = parsed.errors
      ?.map((error) => error.message)
      .filter((message): message is string => message != null && message.length > 0);

    return {
      tool: 'semgrep',
      status: 'failed',
      summary:
        errorMessages != null && errorMessages.length > 0
          ? `Semgrep returned errors: ${errorMessages.join(' | ')}`
          : 'Semgrep returned errors.',
      changed_files,
      findings,
    };
  }

  return {
    tool: 'semgrep',
    status: hasBlocking ? 'failed' : 'passed',
    summary,
    changed_files,
    findings,
  };
}

async function runDocsProcessChecks(projectRoot: string, changed_files: string[]): Promise<ReviewExecutionResult> {
  if (changed_files.length === 0) {
    return {
      tool: 'docs_process',
      status: 'passed',
      summary: 'Docs/process review completed with 0 note(s).',
      changed_files,
      findings: [],
    };
  }

  const target_paths = changed_files;
  const findings: ReviewFinding[] = [];

  for (const relative_path of target_paths) {
    const absolute_path = resolve(projectRoot, relative_path);
    if (!isWithinProjectRoot(projectRoot, absolute_path)) {
      findings.push({
        severity: 'MEDIUM',
        rule_id: 'docs-process/path-outside-project',
        file_path: relative_path,
        line_number: null,
        message: 'Changed file path resolves outside the project root.',
      });
      continue;
    }

    try {
      await access(absolute_path, fsConstants.F_OK);
    } catch {
      findings.push({
        severity: 'MEDIUM',
        rule_id: 'docs-process/missing-path',
        file_path: relative_path,
        line_number: null,
        message: 'Changed file path does not exist locally.',
      });
      continue;
    }

    if (!relative_path.endsWith('.md') && !relative_path.endsWith('.mdx')) {
      findings.push({
        severity: 'INFO',
        rule_id: 'docs-process/non-markdown-file',
        file_path: relative_path,
        line_number: null,
        message: 'Docs/process profile is optimized for markdown; use Semgrep for source files.',
      });
      continue;
    }

    const content = await readFile(absolute_path, 'utf8');
    const lines = content.split('\n');
    for (const [index, line] of lines.entries()) {
      const command_like = line.match(/`(npm|pnpm|yarn|node|npx|git|gh)\s+[^`]+`/g) ?? [];
      if (command_like.length > 0 && line.includes('<')) {
        findings.push({
          severity: 'LOW',
          rule_id: 'docs-process/placeholder-command',
          file_path: relative_path,
          line_number: index + 1,
          message: 'Command example appears to include an unresolved placeholder.',
        });
      }

      const local_links = [...line.matchAll(/\[[^\]]+\]\((?![a-zA-Z][a-zA-Z0-9+\-.]*:|#)([^)]+)\)/g)];
      for (const link of local_links) {
        const raw_target = link[1]?.split('#')[0]?.trim() ?? '';
        if (raw_target.length === 0) {
          continue;
        }
        const target_path = resolve(dirname(absolute_path), raw_target);
        if (!isWithinProjectRoot(projectRoot, target_path)) {
          findings.push({
            severity: 'MEDIUM',
            rule_id: 'docs-process/link-outside-project',
            file_path: relative_path,
            line_number: index + 1,
            message: `Local link points outside the project root: ${raw_target}`,
          });
          continue;
        }

        try {
          await access(target_path, fsConstants.F_OK);
        } catch {
          findings.push({
            severity: 'MEDIUM',
            rule_id: 'docs-process/broken-local-link',
            file_path: relative_path,
            line_number: index + 1,
            message: `Local link target was not found: ${raw_target}`,
          });
        }
      }
    }
  }

  const blocking = findings.some((finding) => finding.severity === 'MEDIUM' || finding.severity === 'HIGH' || finding.severity === 'CRITICAL');
  return {
    tool: 'docs_process',
    status: blocking ? 'failed' : 'passed',
    summary: blocking
      ? `Docs/process review found ${findings.length} issue(s).`
      : `Docs/process review completed with ${findings.length} note(s).`,
    changed_files,
    findings,
  };
}

async function semgrepExists(): Promise<boolean> {
  try {
    const result = await runCommand('semgrep', ['--version'], process.cwd());
    return result.code === 0;
  } catch {
    return false;
  }
}

async function dockerExists(): Promise<boolean> {
  try {
    const result = await runCommand('docker', ['--version'], process.cwd());
    return result.code === 0;
  } catch {
    return false;
  }
}

function isWithinProjectRoot(projectRoot: string, candidatePath: string): boolean {
  const relativePath = relative(projectRoot, candidatePath);
  return relativePath === '' || (relativePath !== '..' && !relativePath.startsWith(`..${sep}`));
}

export class SemgrepReviewAdapter implements ReviewAdapter {
  constructor(private readonly projectRoot: string) {}

  async runChecks(request: RunReviewRequest): Promise<ReviewExecutionResult> {
    if (request.tool === 'docs_process') {
      return runDocsProcessChecks(this.projectRoot, request.changed_files);
    }

    const target_paths = request.changed_files.length > 0 ? request.changed_files : ['.'];

    const existing_paths: string[] = [];
    for (const relative_path of target_paths) {
      const absolute_path = resolve(this.projectRoot, relative_path);
      if (!isWithinProjectRoot(this.projectRoot, absolute_path)) {
        continue;
      }

      try {
        await access(absolute_path, fsConstants.F_OK);
        existing_paths.push(relative(this.projectRoot, absolute_path) || '.');
      } catch {
        // Ignore missing paths. The review result will still explain what was scanned.
      }
    }

    const scan_targets = existing_paths.length > 0 ? existing_paths : ['.'];

    if (await semgrepExists()) {
      const result = await runCommand(
        'semgrep',
        ['scan', '--config=auto', '--json', ...scan_targets],
        this.projectRoot
      );

      if (result.code == null) {
        return {
          tool: 'semgrep',
          status: 'failed',
          summary: 'Semgrep terminated unexpectedly.',
          changed_files: request.changed_files,
          findings: [],
        };
      }

      if (result.stdout.trim().length === 0) {
        return {
          tool: 'semgrep',
          status: 'failed',
          summary: `Semgrep produced no JSON output. stderr: ${result.stderr}`,
          changed_files: request.changed_files,
          findings: [],
        };
      }

      return parseSemgrepJson(result.stdout, request.changed_files);
    }

    if (await dockerExists()) {
      const result = await runCommand(
        'docker',
        [
          'run',
          '--rm',
          '-v',
          `${this.projectRoot}:/src`,
          '-w',
          '/src',
          'returntocorp/semgrep',
          'semgrep',
          'scan',
          '--config=auto',
          '--json',
          ...scan_targets,
        ],
        this.projectRoot
      );

      if (result.code == null || result.stdout.trim().length === 0) {
        return {
          tool: 'semgrep',
          status: 'failed',
          summary: `Docker-backed Semgrep failed. stderr: ${result.stderr}`,
          changed_files: request.changed_files,
          findings: [],
        };
      }

      return parseSemgrepJson(result.stdout, request.changed_files);
    }

    return {
      tool: 'semgrep',
      status: 'queued',
      summary: 'Semgrep is not available locally and Docker is unavailable. Review checks were not executed.',
      changed_files: request.changed_files,
      findings: [],
    };
  }
}
