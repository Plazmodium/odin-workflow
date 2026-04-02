#!/usr/bin/env node

/**
 * Odin Runtime Project Init
 * Version: 0.1.0
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getBundledOdinGuidePath } from './builtin-assets.js';

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
  help: boolean;
}

const VALID_TOOLS: readonly HarnessTool[] = ['opencode', 'claude-code', 'amp', 'codex', 'generic'];
const VALID_DISTRIBUTIONS: readonly DistributionMode[] = ['published', 'source'];

function parseArgs(argv: string[]): InitOptions {
  let projectRoot = process.cwd();
  let force = false;
  let tool: HarnessTool = 'generic';
  let distribution: DistributionMode = 'published';
  let writeMcp = false;
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

  return { projectRoot, force, tool, distribution, writeMcp, help };
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

function getBundledAgentDefinitionsRoot(): string | null {
  const currentFile = fileURLToPath(import.meta.url);
  const packageRoot = resolve(dirname(currentFile), '..');
  const bundledRoot = join(packageRoot, 'builtin', 'agent-definitions');

  return existsSync(bundledRoot) ? bundledRoot : null;
}

function copyTree(sourceRoot: string, targetRoot: string, force: boolean): boolean {
  ensureDir(targetRoot);
  let changed = false;

  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    const sourcePath = join(sourceRoot, entry.name);
    const targetPath = join(targetRoot, entry.name);

    if (entry.isDirectory()) {
      if (copyTree(sourcePath, targetPath, force)) {
        changed = true;
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!existsSync(targetPath) || force) {
      copyFileSync(sourcePath, targetPath);
      changed = true;
    }
  }

  return changed;
}

function ensureBundledGuidance(projectRoot: string, force: boolean): Array<{ path: string; changed: boolean }> {
  const odinDir = join(projectRoot, '.odin');
  ensureDir(odinDir);

  const results: Array<{ path: string; changed: boolean }> = [];
  const bundledGuidePath = getBundledOdinGuidePath();
  if (bundledGuidePath != null) {
    const targetGuidePath = join(odinDir, 'ODIN.md');
    if (!existsSync(targetGuidePath) || force) {
      copyFileSync(bundledGuidePath, targetGuidePath);
      results.push({ path: targetGuidePath, changed: true });
    } else {
      results.push({ path: targetGuidePath, changed: false });
    }
  }

  const bundledDefinitionsRoot = getBundledAgentDefinitionsRoot();
  if (bundledDefinitionsRoot != null) {
    const targetDefinitionsRoot = join(odinDir, 'agents', 'definitions');
    const changed = copyTree(bundledDefinitionsRoot, targetDefinitionsRoot, force);
    results.push({ path: targetDefinitionsRoot, changed });
  }

  return results;
}

function ensureConfig(projectRoot: string, force: boolean): { path: string; changed: boolean } {
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

  return { path: configPath, changed: false };
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
    '1. Read `.odin/ODIN.md` once so the harness has the framework-level rules in project context.',
    '2. Call `odin.prepare_phase_context({ feature_id, phase, agent_name })`.',
    '3. Build the agent prompt from `context.agent.role_summary`, `context.agent.constraints`, `context.agent.definition_markdown`, and `context.development_evals.harness_prompt_block`.',
    '4. Use `odin.get_development_eval_status({ feature_id })` when you need focused eval state instead of parsing broad status payloads.',
    '5. Record structured eval artifacts with `odin.record_eval_plan`, `odin.record_eval_run`, and `odin.record_quality_gate`.',
    '6. Never treat Development Evals as a replacement for `odin.verify_design`, `odin.run_review_checks`, tests, runtime verification, or watcher checks.',
  ].join('\n'));
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const config = ensureConfig(options.projectRoot, options.force);
  const envExample = ensureEnvExample(options.projectRoot, options.force);
  const bundledGuidance = ensureBundledGuidance(options.projectRoot, options.force);
  const mcpSnippet = createMcpJsonSnippet(options.projectRoot, options.distribution);

  console.log('Odin runtime project bootstrap complete.');
  console.log(`- ${config.changed ? 'wrote' : 'kept'} ${config.path}`);
  console.log(`- ${envExample.changed ? 'updated' : 'kept'} ${envExample.path}`);
  for (const item of bundledGuidance) {
    console.log(`- ${item.changed ? 'updated' : 'kept'} ${item.path}`);
  }
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
  console.log('2. Have your harness read `.odin/ODIN.md` before running the workflow');
  console.log('3. Copy .env.example to .env when you are ready for database-backed tools');
  console.log('4. Switch `.odin/config.yaml` to `runtime.mode: supabase` for persistent workflow state');
  if (options.writeMcp) {
    console.log('5. Review the generated harness config and confirm it matches your local setup');
  } else {
    console.log('5. Add the printed MCP snippet to your harness config');
  }
  console.log('6. Start using Odin — your AI agent now has workflow tools available');

  printHarnessSnippet(options.projectRoot, options.tool, options.distribution);
}

main();
