#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import type { StartFeatureInput } from './schemas.js';
import type { FeatureRecord } from './types.js';
import { deriveFeatureBranchName } from './domain/feature-branch.js';

const execFileAsync = promisify(execFile);

interface FeatureStartCliOptions extends StartFeatureInput {
  projectRoot: string;
  help: boolean;
}

interface FeatureStartResult {
  feature: FeatureRecord;
  branch_name: string;
  branch_action: 'created' | 'switched' | 'already_on_branch';
}

export interface GitWorkspaceManager {
  prepareFeatureBranch(projectRoot: string, branchName: string, baseBranch: string): Promise<'created' | 'switched' | 'already_on_branch'>;
}

export interface FeatureStartClient {
  startFeature(input: StartFeatureInput): Promise<FeatureRecord>;
  close(): Promise<void>;
}

function printHelp(): void {
  console.log([
    'Usage: odin start-feature [options]',
    '',
    'Create/switch the feature branch first, then record the feature in Odin.',
    '',
    'Required options:',
    '  --project-root <path>       Target project directory',
    '  --id <feature-id>           Feature identifier (for example AUTH-001)',
    '  --name <feature-name>       Human-readable feature name',
    '  --complexity-level <1|2|3>  Feature complexity',
    '  --severity <level>          ROUTINE | EXPEDITED | CRITICAL',
    '  --author <name>             Real human author name',
    '',
    'Optional:',
    '  --dev-initials <initials>   Used to derive {initials}/feature/{FEATURE-ID}',
    '  --base-branch <name>        Base branch to branch from (default: main)',
    '  --requirements-path <path>  Optional requirements artifact path',
    '  -h, --help                  Show this help message',
    '',
    'Example:',
    '  odin start-feature --project-root ./app --id AUTH-001 --name "Login" --complexity-level 2 --severity ROUTINE --author "Jane Doe" --dev-initials jd',
  ].join('\n'));
}

function readOption(options: Map<string, string>, key: string): string | undefined {
  const value = options.get(key);
  return value == null || value.trim().length === 0 ? undefined : value;
}

function parseComplexityLevel(value: string | undefined): 1 | 2 | 3 {
  if (value === '1' || value === '2' || value === '3') {
    return Number(value) as 1 | 2 | 3;
  }

  throw new Error('Invalid --complexity-level. Expected 1, 2, or 3.');
}

function parseSeverity(value: string | undefined): 'ROUTINE' | 'EXPEDITED' | 'CRITICAL' {
  if (value === 'ROUTINE' || value === 'EXPEDITED' || value === 'CRITICAL') {
    return value;
  }

  throw new Error('Invalid --severity. Expected ROUTINE, EXPEDITED, or CRITICAL.');
}

export function parseArgs(argv: string[]): FeatureStartCliOptions {
  const options = new Map<string, string>();
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }

    if (!arg?.startsWith('--')) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next == null || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}.`);
    }

    options.set(key, next);
    index += 1;
  }

  if (help) {
    return {
      projectRoot: process.cwd(),
      id: 'HELP',
      name: 'HELP',
      complexity_level: 1,
      severity: 'ROUTINE',
      author: 'HELP',
      help: true,
    };
  }

  const projectRoot = resolve(readOption(options, 'project-root') ?? process.cwd());
  const id = readOption(options, 'id');
  const name = readOption(options, 'name');
  const author = readOption(options, 'author');

  if (id == null) {
    throw new Error('Missing required option --id.');
  }
  if (name == null) {
    throw new Error('Missing required option --name.');
  }
  if (author == null) {
    throw new Error('Missing required option --author.');
  }

  return {
    projectRoot,
    id,
    name,
    author,
    complexity_level: parseComplexityLevel(readOption(options, 'complexity-level')),
    severity: parseSeverity(readOption(options, 'severity')),
    requirements_path: readOption(options, 'requirements-path'),
    dev_initials: readOption(options, 'dev-initials'),
    base_branch: readOption(options, 'base-branch') ?? 'main',
    help: false,
  };
}

async function runGit(projectRoot: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', args, { cwd: projectRoot });
}

function gitMessage(error: unknown): string {
  if (error instanceof Error && 'stderr' in error) {
    const stderr = error.stderr;
    if (typeof stderr === 'string' && stderr.trim().length > 0) {
      return stderr.trim();
    }
  }

  return error instanceof Error ? error.message : 'Unknown git error';
}

export function createGitWorkspaceManager(): GitWorkspaceManager {
  return {
    async prepareFeatureBranch(projectRoot, branchName, baseBranch) {
      try {
        await runGit(projectRoot, ['rev-parse', '--is-inside-work-tree']);
      } catch (error) {
        throw new Error(`Cannot start feature in ${projectRoot}: this directory is not a git repository. ${gitMessage(error)}`);
      }

      const currentBranch = (await runGit(projectRoot, ['branch', '--show-current'])).stdout.trim();
      if (currentBranch === branchName) {
        return 'already_on_branch';
      }

      const branchExists = await runGit(projectRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`])
        .then(() => true)
        .catch(() => false);
      if (branchExists) {
        try {
          await runGit(projectRoot, ['switch', branchName]);
          return 'switched';
        } catch (error) {
          throw new Error(`Cannot switch to existing feature branch ${branchName} in ${projectRoot}. ${gitMessage(error)}`);
        }
      }

      const baseExists = await runGit(projectRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${baseBranch}`])
        .then(() => true)
        .catch(() => false);
      if (!baseExists) {
        throw new Error(`Cannot create feature branch ${branchName}: base branch ${baseBranch} does not exist locally in ${projectRoot}.`);
      }

      try {
        await runGit(projectRoot, ['switch', '-c', branchName, baseBranch]);
        return 'created';
      } catch (error) {
        throw new Error(`Cannot create feature branch ${branchName} from ${baseBranch} in ${projectRoot}. ${gitMessage(error)}`);
      }
    },
  };
}

function runtimeServerPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const distDir = dirname(currentFile);
  return join(distDir, 'server.js');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function extractError(result: Record<string, unknown>): string | null {
  if (result.isError !== true) {
    return null;
  }

  const content = result.content;
  if (!Array.isArray(content)) {
    return 'Odin runtime returned an unknown error.';
  }

  for (const item of content) {
    if (isRecord(item) && typeof item.text === 'string') {
      return item.text;
    }
  }

  return 'Odin runtime returned an unknown error.';
}

function extractFeature(structuredContent: unknown): FeatureRecord {
  if (!isRecord(structuredContent)) {
    throw new Error('Odin start_feature did not return structured content.');
  }

  const feature = structuredContent.feature;
  if (!isRecord(feature)) {
    throw new Error('Odin start_feature did not return a feature payload.');
  }

  return feature as unknown as FeatureRecord;
}

/**
 * Creates and connects a FeatureStartClient configured to run the Odin runtime for the specified project root.
 *
 * @param projectRoot - Absolute path to the target project directory; used as the runtime working directory and provided to the runtime via the `ODIN_PROJECT_ROOT` environment variable.
 * @returns A connected FeatureStartClient exposing `startFeature(input)` to invoke the runtime's feature-start tool and `close()` to shut down the underlying transport.
 */
export async function connectFeatureStartClient(projectRoot: string): Promise<FeatureStartClient> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [runtimeServerPath()],
    cwd: projectRoot,
    env: {
      ...process.env,
      ODIN_PROJECT_ROOT: projectRoot,
    },
  });
  const client = new Client({
    name: 'odin-feature-start',
    version: '0.8.3-beta',
  });
  await client.connect(transport);

  return {
    async startFeature(input) {
      const result = await client.callTool({
        name: 'odin.start_feature',
        arguments: input,
      });
      const error = extractError(result);
      if (error != null) {
        throw new Error(error);
      }

      return extractFeature(result.structuredContent);
    },
    async close() {
      await transport.close();
    },
  };
}

export async function executeStartFeatureFlow(
  options: FeatureStartCliOptions,
  git: GitWorkspaceManager,
  client: FeatureStartClient,
): Promise<FeatureStartResult> {
  const branch_name = deriveFeatureBranchName(options.id, options.dev_initials);
  const branch_action = await git.prepareFeatureBranch(options.projectRoot, branch_name, options.base_branch ?? 'main');

  const feature = await client.startFeature({
    id: options.id,
    name: options.name,
    complexity_level: options.complexity_level,
    severity: options.severity,
    requirements_path: options.requirements_path,
    dev_initials: options.dev_initials,
    base_branch: options.base_branch,
    author: options.author,
  });

  return {
    feature,
    branch_name: feature.branch_name ?? branch_name,
    branch_action,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const client = await connectFeatureStartClient(options.projectRoot);
  try {
    const result = await executeStartFeatureFlow(options, createGitWorkspaceManager(), client);
    const action_label =
      result.branch_action === 'created'
        ? 'Created'
        : result.branch_action === 'switched'
          ? 'Switched to'
          : 'Using existing';
    console.log(`${action_label} branch ${result.branch_name}.`);
    console.log(`Started feature ${result.feature.id} at phase ${result.feature.current_phase} (${result.feature.status}).`);
  } finally {
    await client.close();
  }
}

const entrypoint = process.argv[1] == null ? null : resolve(process.argv[1]);
const current_file = resolve(fileURLToPath(import.meta.url));

if (entrypoint === current_file) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown odin start-feature failure';
    console.error(`[Odin Runtime] ${message}`);
    process.exitCode = 1;
  });
}
