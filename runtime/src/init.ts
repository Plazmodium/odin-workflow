#!/usr/bin/env node

/**
 * Odin Runtime Project Init
 * Version: 0.1.0
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

const PUBLISHED_PACKAGE_NAME = '@plazmodium/odin';

const CONFIG_TEMPLATE = [
  'runtime:',
  '  mode: in_memory',
  '',
  '# Switch to `supabase` when you want persistent workflow state.',
  '# runtime:',
  '#   mode: supabase',
  '',
  'supabase:',
  '  url: ${SUPABASE_URL}',
  '  secret_key: ${SUPABASE_SECRET_KEY}',
  '',
  'skills:',
  '  paths:',
  '    - .odin/skills',
  '  defaults: []',
  '  auto_detect: true',
  '',
  'review:',
  '  provider: semgrep',
  '',
  'automation:',
  '  mode: guarded',
  '  allowed_base_branches: []',
  '  require_green_checks: true',
  '  require_clean_policy_checks: true',
  '  require_no_open_blockers: true',
  '  require_watched_claims_verified: true',
  '  paused: false',
  '  kill_switch: false',
  '  merge_strategy: squash',
  '',
  '# `auto_pr` is opt-in and only works on allowlisted base branches.',
  '# `auto_merge` is reserved for future use and is not supported yet.',
  '',
  'attestation:',
  '  # advisory warns; strict blocks configured phases unless an override reason is supplied.',
  '  mode: advisory',
  '  require_execution_phases: ["5", "6", "7", "9"]',
  '  require_prompt_realization_phases: ["5", "6", "7", "9"]',
  '',
  '# formal_verification:',
  '#   provider: tla-precheck    # requires: Java 17+, npm install -D tla-precheck',
  '#   timeout_seconds: 120',
  '',
  'archive:',
  '  provider: none',
  '',
  '# Enable Supabase archival after switching workflow state to remote Supabase.',
  '# archive:',
  '#   provider: supabase',
  '',
].join('\n');

const ENV_LINES = [
  'DATABASE_URL=postgresql://user:password@host:5432/dbname',
  'SUPABASE_URL=https://your-project.supabase.co',
  'SUPABASE_SECRET_KEY=your-secret-key',
  'SUPABASE_ACCESS_TOKEN=your-management-api-access-token',
];

type HarnessTool = 'opencode' | 'claude-code' | 'amp' | 'codex' | 'generic';
type DistributionMode = 'published' | 'source';

interface InitOptions {
  projectRoot: string;
  force: boolean;
  tool: HarnessTool;
  distribution: DistributionMode;
  writeMcp: boolean;
  syncManagedAssets: boolean;
  help: boolean;
}

interface ManagedAssetManifest {
  version: 1;
  files: Record<string, string>;
}

interface ManagedAssetSyncResult {
  written: number;
  kept: number;
  conflicts: string[];
  manifest_path: string;
}

interface ManagedFileTarget {
  source: string;
  managedPath: string;
}

const VALID_TOOLS: readonly HarnessTool[] = ['opencode', 'claude-code', 'amp', 'codex', 'generic'];
const VALID_DISTRIBUTIONS: readonly DistributionMode[] = ['published', 'source'];

function parseArgs(argv: string[]): InitOptions {
  let projectRoot = process.cwd();
  let force = false;
  let tool: HarnessTool = 'generic';
  let distribution: DistributionMode = 'published';
  let writeMcp = false;
  let syncManagedAssets = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }

    if (arg === '--project-root') {
      const next = argv[index + 1];
      if (next != null) {
        projectRoot = resolve(next);
        index += 1;
      }
      continue;
    }

    if (arg === '--force') {
      force = true;
    }

    if (arg === '--write-mcp') {
      writeMcp = true;
    }

    if (arg === '--sync-managed-assets') {
      syncManagedAssets = true;
    }

    if (arg === '--tool') {
      const next = argv[index + 1] as HarnessTool | undefined;
      if (next != null && (VALID_TOOLS as readonly string[]).includes(next)) {
        tool = next;
        index += 1;
      }
      continue;
    }

    if (arg === '--distribution') {
      const next = argv[index + 1] as DistributionMode | undefined;
      if (next != null && (VALID_DISTRIBUTIONS as readonly string[]).includes(next)) {
        distribution = next;
        index += 1;
      }
    }
  }

  return { projectRoot, force, tool, distribution, writeMcp, syncManagedAssets, help };
}

function printHelp(): void {
  console.log(`
Usage: odin init [options]

Bootstrap Odin configuration for a project.

Options:
  --project-root <path>  Target project directory (default: cwd)
  --tool <name>          Harness to generate config for:
                             opencode, claude-code, amp, codex, generic (default)
  --distribution <mode>  MCP server command strategy:
                             published, source (default: published)
  --write-mcp            Write the harness config file directly
                              (opencode.json for opencode,
                               .mcp.json for claude-code/amp,
                               .codex/config.toml for codex)
  --sync-managed-assets  Copy packaged Odin agent definitions and built-in skills into .odin/
  --force                Overwrite existing config files
  -h, --help             Show this help message

Examples:
  odin init --project-root ./my-app --tool amp --write-mcp
  odin init --tool opencode --write-mcp
  odin init --tool codex --distribution source --write-mcp
`.trim());
}

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function mergeMissingDefaults(
  defaults: Record<string, unknown>,
  existing: Record<string, unknown>,
): { value: Record<string, unknown>; changed: boolean } {
  let changed = false;
  const merged: Record<string, unknown> = { ...existing };

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const existingValue = merged[key];
    if (existingValue == null) {
      merged[key] = defaultValue;
      changed = true;
      continue;
    }

    if (isRecord(defaultValue) && isRecord(existingValue)) {
      const child = mergeMissingDefaults(defaultValue, existingValue);
      if (child.changed) {
        merged[key] = child.value;
        changed = true;
      }
    }
  }

  return { value: merged, changed };
}

function parseYamlRecord(path: string, content: string): Record<string, unknown> {
  const parsed = YAML.parse(content) as unknown;
  if (parsed == null) {
    return {};
  }

  if (!isRecord(parsed)) {
    throw new Error(`Cannot patch ${path} because the config root is not a mapping/object.`);
  }

  return parsed;
}

function ensureConfig(projectRoot: string, force: boolean): { path: string; changed: boolean; warning?: string } {
  const odinDir = join(projectRoot, '.odin');
  const configPath = join(odinDir, 'config.yaml');
  const skillsDir = join(odinDir, 'skills');
  ensureDir(odinDir);
  ensureDir(skillsDir);

  const gitkeepPath = join(skillsDir, '.gitkeep');
  if (!existsSync(gitkeepPath)) {
    writeFileSync(gitkeepPath, '', 'utf8');
  }

  if (!existsSync(configPath) || force) {
    writeFileSync(configPath, CONFIG_TEMPLATE, 'utf8');
    return { path: configPath, changed: true };
  }

  try {
    const existing = parseYamlRecord(configPath, readFileSync(configPath, 'utf8'));
    const defaults = parseYamlRecord('Odin config template', CONFIG_TEMPLATE);
    const patched = mergeMissingDefaults(defaults, existing);
    if (patched.changed) {
      writeFileSync(configPath, YAML.stringify(patched.value), 'utf8');
      return { path: configPath, changed: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown config parse failure';
    return {
      path: configPath,
      changed: false,
      warning: `Could not patch ${configPath}; left it unchanged. Fix the config and rerun Odin init. ${message}`,
    };
  }

  return { path: configPath, changed: false };
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function readManagedAssetManifest(path: string): ManagedAssetManifest {
  if (!existsSync(path)) {
    return { version: 1, files: {} };
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<ManagedAssetManifest>;
    if (parsed.version === 1 && isRecord(parsed.files)) {
      return {
        version: 1,
        files: Object.fromEntries(
          Object.entries(parsed.files).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        ),
      };
    }
  } catch {
    // Treat malformed manifests as absent; conflict checks still protect edited files.
  }

  return { version: 1, files: {} };
}

function collectFiles(root: string): string[] {
  const files: string[] = [];

  function visit(current: string): void {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }

      if (entry.isFile()) {
        files.push(absolute);
      }
    }
  }

  visit(root);
  return files;
}

function relativeAssetPath(assetRoot: string, file: string): string {
  return file.slice(assetRoot.length + 1).replace(/\\/g, '/');
}

function resolveAssetRoot(requiredPaths: readonly string[]): string {
  const currentFile = fileURLToPath(import.meta.url);
  const packageRoot = resolve(dirname(currentFile), '..');
  const candidates = [
    join(packageRoot, 'assets'),
    join(packageRoot, '..', 'assets'),
    join(packageRoot, '..'),
  ];

  const found = candidates.find((candidate) =>
    requiredPaths.every((requiredPath) => existsSync(join(candidate, requiredPath)))
  );
  if (found == null) {
    throw new Error(
      `Could not resolve packaged Odin assets with required paths (${requiredPaths.join(', ')}). Checked: ${candidates.join(', ')}.`
    );
  }

  return found;
}

function syncManagedFiles(projectRoot: string, force: boolean, targets: ManagedFileTarget[]): ManagedAssetSyncResult {
  const odinDir = join(projectRoot, '.odin');
  const manifestPath = join(odinDir, 'managed-assets.json');
  const manifest = readManagedAssetManifest(manifestPath);
  const nextManifest: ManagedAssetManifest = { version: 1, files: { ...manifest.files } };
  let written = 0;
  let kept = 0;
  const conflicts: string[] = [];

  ensureDir(odinDir);

  for (const target of targets) {
    const destination = join(projectRoot, target.managedPath);
    const sourceContent = readFileSync(target.source, 'utf8');
    const sourceHash = hashContent(sourceContent);
    const previousHash = manifest.files[target.managedPath];

    if (!existsSync(destination) || force) {
      ensureDir(dirname(destination));
      writeFileSync(destination, sourceContent, 'utf8');
      nextManifest.files[target.managedPath] = sourceHash;
      written += 1;
      continue;
    }

    const currentContent = readFileSync(destination, 'utf8');
    const currentHash = hashContent(currentContent);
    if (currentHash === sourceHash) {
      nextManifest.files[target.managedPath] = sourceHash;
      kept += 1;
      continue;
    }

    if (previousHash != null && currentHash === previousHash) {
      writeFileSync(destination, sourceContent, 'utf8');
      nextManifest.files[target.managedPath] = sourceHash;
      written += 1;
      continue;
    }

    conflicts.push(target.managedPath);
  }

  writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
  return { written, kept, conflicts, manifest_path: manifestPath };
}

function collectManagedDirectoryTargets(sourceRoot: string, targetPrefix: string): ManagedFileTarget[] {
  if (!existsSync(sourceRoot)) {
    return [];
  }

  return collectFiles(sourceRoot).map((source) => ({
    source,
    managedPath: `${targetPrefix}/${relativeAssetPath(sourceRoot, source)}`,
  }));
}

function ensureWorkflowGuide(projectRoot: string, force: boolean): ManagedAssetSyncResult {
  const assetRoot = resolveAssetRoot(['ODIN.md']);
  return syncManagedFiles(projectRoot, force, [
    { source: join(assetRoot, 'ODIN.md'), managedPath: '.odin/ODIN.md' },
  ]);
}

function ensureManagedAssets(projectRoot: string, force: boolean): ManagedAssetSyncResult {
  const assetRoot = resolveAssetRoot(['ODIN.md', 'agents/definitions', 'agents/skills']);
  return syncManagedFiles(projectRoot, force, [
    ...collectManagedDirectoryTargets(join(assetRoot, 'agents', 'definitions'), '.odin/agents/definitions'),
    ...collectManagedDirectoryTargets(join(assetRoot, 'agents', 'skills'), '.odin/skills'),
  ]);
}

function ensureEnvExample(projectRoot: string, force: boolean): { path: string; changed: boolean } {
  const envExamplePath = join(projectRoot, '.env.example');

  if (!existsSync(envExamplePath) || force) {
    writeFileSync(envExamplePath, `${ENV_LINES.join('\n')}\n`, 'utf8');
    return { path: envExamplePath, changed: true };
  }

  const existing = readFileSync(envExamplePath, 'utf8').split('\n');
  const missing = ENV_LINES.filter((line) => {
    const key = line.split('=', 1)[0];
    return !existing.some((existingLine) => existingLine.startsWith(`${key}=`));
  });

  if (missing.length > 0) {
    const separator = existing.length > 0 && existing.at(-1) !== '' ? '\n' : '';
    writeFileSync(envExamplePath, `${readFileSync(envExamplePath, 'utf8')}${separator}${missing.join('\n')}\n`, 'utf8');
    return { path: envExamplePath, changed: true };
  }

  return { path: envExamplePath, changed: false };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return { ...value };
  }

  return {};
}

function createCommandSpec(distribution: DistributionMode): { command: string; args: string[] } {
  if (distribution === 'published') {
    return {
      command: 'npx',
      args: ['-y', PUBLISHED_PACKAGE_NAME, 'mcp'],
    };
  }

  const currentFile = fileURLToPath(import.meta.url);
  const distDir = dirname(currentFile);

  return {
    command: 'node',
    args: [join(distDir, 'server.js')],
  };
}

function createMcpJsonSnippet(projectRoot: string, distribution: DistributionMode) {
  const commandSpec = createCommandSpec(distribution);

  return {
    mcpServers: {
      odin: {
        command: commandSpec.command,
        args: commandSpec.args,
        env: {
          ODIN_PROJECT_ROOT: projectRoot,
        },
      },
    },
  };
}

function createOpenCodeSnippet(projectRoot: string, distribution: DistributionMode) {
  const commandSpec = createCommandSpec(distribution);

  return {
    $schema: 'https://opencode.ai/config.json',
    mcp: {
      odin: {
        type: 'local',
        command: [commandSpec.command, ...commandSpec.args],
        enabled: true,
        environment: {
          ODIN_PROJECT_ROOT: projectRoot,
        },
      },
    },
  };
}

function createCodexTomlSnippet(projectRoot: string, distribution: DistributionMode): string {
  const commandSpec = createCommandSpec(distribution);
  const normalizedArgs = commandSpec.args.map((arg) => arg.replace(/\\/g, '/'));
  const normalizedProjectRoot = projectRoot.replace(/\\/g, '/');

  return [
    '[mcp_servers.odin]',
    `command = "${commandSpec.command}"`,
    `args = [${normalizedArgs.map((arg) => `"${arg}"`).join(', ')}]`,
    `env = { ODIN_PROJECT_ROOT = "${normalizedProjectRoot}" }`,
    '',
  ].join('\n');
}

function parseJsonFile(path: string): { [key: string]: unknown } {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as { [key: string]: unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse failure';
    throw new Error(
      `Cannot update ${path} because it is not valid JSON. Fix the file or remove it, then rerun Odin bootstrap. Parser error: ${message}`
    );
  }
}

function writeMcpFile(projectRoot: string, snippet: ReturnType<typeof createMcpJsonSnippet>, force: boolean): { path: string; changed: boolean } {
  const mcpPath = join(projectRoot, '.mcp.json');

  if (!existsSync(mcpPath)) {
    writeFileSync(mcpPath, `${JSON.stringify(snippet, null, 2)}\n`, 'utf8');
    return { path: mcpPath, changed: true };
  }

  const existing = parseJsonFile(mcpPath);
  const existingServers = asRecord(existing.mcpServers);
  const merged = {
    ...existing,
    mcpServers: {
      ...existingServers,
      ...snippet.mcpServers,
    },
  };

  const current = JSON.stringify(existing, null, 2);
  const next = JSON.stringify(merged, null, 2);
  if (current === next && !force) {
    return { path: mcpPath, changed: false };
  }

  writeFileSync(mcpPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  return { path: mcpPath, changed: true };
}

function writeOpenCodeConfig(projectRoot: string, distribution: DistributionMode, force: boolean): { path: string; changed: boolean } {
  const configPath = join(projectRoot, 'opencode.json');
  const snippet = createOpenCodeSnippet(projectRoot, distribution);

  if (!existsSync(configPath)) {
    writeFileSync(configPath, `${JSON.stringify(snippet, null, 2)}\n`, 'utf8');
    return { path: configPath, changed: true };
  }

  const existing = parseJsonFile(configPath);
  const existingMcp = asRecord(existing.mcp);
  const merged = {
    ...existing,
    $schema:
      typeof existing.$schema === 'string' && existing.$schema.length > 0
        ? existing.$schema
        : 'https://opencode.ai/config.json',
    mcp: {
      ...existingMcp,
      ...snippet.mcp,
    },
  };

  const current = JSON.stringify(existing, null, 2);
  const next = JSON.stringify(merged, null, 2);
  if (current === next && !force) {
    return { path: configPath, changed: false };
  }

  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  return { path: configPath, changed: true };
}

function upsertCodexBlock(existing: string, snippet: string): { content: string; changed: boolean } {
  const normalizedSnippet = snippet.trimEnd();
  const blockRegex = /^\[mcp_servers\.odin\][\s\S]*?(?=^\[[^\]]+\]|\Z)/m;

  if (blockRegex.test(existing)) {
    const updated = existing.replace(blockRegex, normalizedSnippet);
    return {
      content: updated.endsWith('\n') ? updated : `${updated}\n`,
      changed: updated !== existing,
    };
  }

  const separator = existing.length === 0 ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  const updated = `${existing}${separator}${normalizedSnippet}\n`;
  return { content: updated, changed: true };
}

function writeCodexConfig(projectRoot: string, distribution: DistributionMode, force: boolean): { path: string; changed: boolean } {
  const codexDir = join(projectRoot, '.codex');
  const codexConfigPath = join(codexDir, 'config.toml');
  ensureDir(codexDir);

  const snippet = createCodexTomlSnippet(projectRoot, distribution);

  if (!existsSync(codexConfigPath)) {
    writeFileSync(codexConfigPath, snippet, 'utf8');
    return { path: codexConfigPath, changed: true };
  }

  const existing = readFileSync(codexConfigPath, 'utf8');
  const { content, changed } = upsertCodexBlock(existing, snippet);

  if (!changed && !force) {
    return { path: codexConfigPath, changed: false };
  }

  writeFileSync(codexConfigPath, content, 'utf8');
  return { path: codexConfigPath, changed: true };
}

function isMcpJsonTool(tool: HarnessTool): boolean {
  return tool === 'claude-code' || tool === 'amp';
}

/**
 * Print a harness MCP configuration snippet and concise eval-aware orchestration tips for a given tool and distribution.
 *
 * @param projectRoot - Absolute path to the project root; used when generating the snippet
 * @param tool - Target harness tool (e.g., `opencode`, `claude-code`, `amp`, `codex`, `generic`)
 * @param distribution - Distribution mode that affects the generated command spec (`published` or `source`)
 */
function printHarnessSnippet(projectRoot: string, tool: HarnessTool, distribution: DistributionMode): void {
  const target = tool === 'opencode'
    ? 'opencode.json'
    : isMcpJsonTool(tool)
    ? '.mcp.json'
    : tool === 'codex'
      ? '.codex/config.toml'
      : 'your tool MCP config';
  console.log(`\nHarness MCP config snippet for ${tool} (${target}):\n`);
  if (tool === 'codex') {
    console.log(createCodexTomlSnippet(projectRoot, distribution));
  } else if (tool === 'opencode') {
    console.log(JSON.stringify(createOpenCodeSnippet(projectRoot, distribution), null, 2));
  } else {
    console.log(JSON.stringify(createMcpJsonSnippet(projectRoot, distribution), null, 2));
  }

  if (tool === 'generic') {
    console.log('\nGeneric note: add the `odin` server block to whatever MCP config mechanism your tool supports.');
  }

  console.log('\nEval-aware orchestration tip:');
  console.log(
    '- Prefer `odin.get_development_eval_status({ feature_id })` when the harness needs focused eval state (latest eval_plan, eval_run, and eval_readiness) instead of parsing the broader `odin.get_feature_status` payload.'
  );

  console.log('\nCanonical eval-aware orchestration snippet:');
  console.log([
    '1. Call `odin.prepare_phase_context({ feature_id, phase, agent_name })`.',
    '2. Build the agent prompt from `context.agent.name`, `context.agent.role_summary`, and `context.agent.constraints`.',
    '3. Use `context.execution.recommended_mode` as the default inline/subagent choice.',
    '4. If the child cannot call `odin.*` directly, proxy those calls from the parent session and pass `context.execution.acting_agent_name` through to fields like `agent_name` and `created_by`.',
    '5. Use `odin.get_development_eval_status({ feature_id })` when you need focused eval state instead of parsing broad status payloads.',
    '6. Record structured eval artifacts with `odin.record_eval_plan`, `odin.record_eval_run`, and `odin.record_quality_gate`, or use `odin.complete_phase_bundle` when recording a phase completion as one validated operation.',
    '7. Include `artifact_path` for durable phase files such as `documentation-report.md` so expected artifact checks can inspect filenames.',
    '8. Never treat Development Evals as a replacement for `odin.verify_design`, `odin.run_review_checks`, tests, runtime verification, or watcher checks.',
  ].join('\n'));
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const config = ensureConfig(options.projectRoot, options.force);
  const workflowGuide = ensureWorkflowGuide(options.projectRoot, options.force);
  const managedAssets = options.syncManagedAssets ? ensureManagedAssets(options.projectRoot, options.force) : null;
  const envExample = ensureEnvExample(options.projectRoot, options.force);
  const mcpSnippet = createMcpJsonSnippet(options.projectRoot, options.distribution);
  const tomlConfigPath = join(options.projectRoot, '.odin', 'config.toml');

  console.log('Odin runtime project bootstrap complete.');
  console.log(`- ${config.changed ? 'wrote' : 'kept'} ${config.path}`);
  if (config.warning != null) {
    console.log(`- warning: ${config.warning}`);
  }
  if (existsSync(tomlConfigPath)) {
    console.log(`- kept ${tomlConfigPath} (Odin runtime reads .odin/config.yaml; .odin/config.toml is not active runtime config)`);
  }
  if (workflowGuide.conflicts.length > 0) {
    console.log(
      `- skipped locally modified Odin workflow guide; rerun with --force to overwrite: ${workflowGuide.conflicts.join(', ')}`
    );
  } else {
    console.log(`- ${workflowGuide.written > 0 ? 'wrote' : 'kept'} ${join(options.projectRoot, '.odin', 'ODIN.md')}`);
  }
  if (managedAssets == null) {
    console.log('- skipped broad Odin managed asset sync (rerun with --sync-managed-assets to copy agent definitions and built-in skills)');
  } else {
    console.log(
      `- synced Odin managed assets: ${managedAssets.written} written, ${managedAssets.kept} kept (${managedAssets.manifest_path})`
    );
  }
  if (managedAssets != null && managedAssets.conflicts.length > 0) {
    console.log(
      `- skipped ${managedAssets.conflicts.length} locally modified Odin managed asset(s); rerun with --force to overwrite: ${managedAssets.conflicts.join(', ')}`
    );
  }
  console.log(`- ${envExample.changed ? 'updated' : 'kept'} ${envExample.path}`);
  console.log(`- runtime quick-start mode: in_memory`);
  console.log(`- MCP command mode: ${options.distribution}`);

  if (options.writeMcp && isMcpJsonTool(options.tool)) {
    const mcp = writeMcpFile(options.projectRoot, mcpSnippet, options.force);
    console.log(`- ${mcp.changed ? 'updated' : 'kept'} ${mcp.path}`);
  }

  if (options.writeMcp && options.tool === 'opencode') {
    const openCodeConfig = writeOpenCodeConfig(options.projectRoot, options.distribution, options.force);
    console.log(`- ${openCodeConfig.changed ? 'updated' : 'kept'} ${openCodeConfig.path}`);
  }

  if (options.writeMcp && options.tool === 'codex') {
    const codexConfig = writeCodexConfig(options.projectRoot, options.distribution, options.force);
    console.log(`- ${codexConfig.changed ? 'updated' : 'kept'} ${codexConfig.path}`);
  }

  console.log('\nNext steps:');
  console.log('1. Connect your MCP host and confirm Odin boots in in_memory mode');
  console.log('2. Copy .env.example to .env when you are ready for database-backed tools');
  console.log('3. Switch `.odin/config.yaml` to `runtime.mode: supabase` for persistent workflow state');
  if (options.writeMcp) {
    console.log('4. Review the generated harness config and confirm it matches your local setup');
  } else {
    console.log('4. Add the printed MCP snippet to your harness config');
  }
  console.log('5. Start using Odin — your AI agent now has workflow tools available');

  printHarnessSnippet(options.projectRoot, options.tool, options.distribution);
}

main();
