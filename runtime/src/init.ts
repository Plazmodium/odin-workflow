#!/usr/bin/env node

/**
 * Odin Runtime Project Init
 * Version: 0.1.0
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_TEMPLATE = [
  'runtime:',
  '  mode: supabase',
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
  '# formal_verification:',
  '#   provider: tla-precheck    # requires: Java 17+, npm install -D tla-precheck',
  '#   timeout_seconds: 120',
  '',
  'archive:',
  '  provider: supabase',
  '',
].join('\n');

const ENV_LINES = [
  'SUPABASE_URL=https://your-project.supabase.co',
  'SUPABASE_SECRET_KEY=your-secret-key',
  'SUPABASE_ACCESS_TOKEN=your-management-api-access-token',
];

type HarnessTool = 'opencode' | 'claude-code' | 'amp' | 'codex' | 'generic';

interface InitOptions {
  projectRoot: string;
  force: boolean;
  tool: HarnessTool;
  writeMcp: boolean;
  help: boolean;
}

const VALID_TOOLS: readonly HarnessTool[] = ['opencode', 'claude-code', 'amp', 'codex', 'generic'];

function parseArgs(argv: string[]): InitOptions {
  let projectRoot = process.cwd();
  let force = false;
  let tool: HarnessTool = 'generic';
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
    }
  }

  return { projectRoot, force, tool, writeMcp, help };
}

function printHelp(): void {
  console.log(`
Usage: odin-runtime-init [options]

Bootstrap Odin configuration for a project.

Options:
  --project-root <path>  Target project directory (default: cwd)
  --tool <name>          Harness to generate config for:
                            opencode, claude-code, amp, codex, generic (default)
  --write-mcp            Write the harness config file directly
                            (opencode.json for opencode,
                             .mcp.json for claude-code/amp,
                             .codex/config.toml for codex)
  --force                Overwrite existing config files
  -h, --help             Show this help message

Examples:
  odin-runtime-init --project-root ./my-app --tool amp --write-mcp
  odin-runtime-init --tool opencode
  odin-runtime-init --tool codex --write-mcp
`.trim());
}

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
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

function createMcpJsonSnippet(projectRoot: string) {
  const currentFile = fileURLToPath(import.meta.url);
  const distDir = dirname(currentFile);
  const serverPath = join(distDir, 'server.js');

  return {
    mcpServers: {
      odin: {
        command: 'node',
        args: [serverPath],
        env: {
          ODIN_PROJECT_ROOT: projectRoot,
        },
      },
    },
  };
}

function createOpenCodeSnippet(projectRoot: string) {
  const currentFile = fileURLToPath(import.meta.url);
  const distDir = dirname(currentFile);
  const serverPath = join(distDir, 'server.js');

  return {
    $schema: 'https://opencode.ai/config.json',
    mcp: {
      odin: {
        type: 'local',
        command: ['node', serverPath],
        enabled: true,
        environment: {
          ODIN_PROJECT_ROOT: projectRoot,
        },
      },
    },
  };
}

function createCodexTomlSnippet(projectRoot: string): string {
  const currentFile = fileURLToPath(import.meta.url);
  const distDir = dirname(currentFile);
  const serverPath = join(distDir, 'server.js').replace(/\\/g, '/');
  const normalizedProjectRoot = projectRoot.replace(/\\/g, '/');

  return [
    '[mcp_servers.odin]',
    'command = "node"',
    `args = ["${serverPath}"]`,
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

function writeOpenCodeConfig(projectRoot: string, force: boolean): { path: string; changed: boolean } {
  const configPath = join(projectRoot, 'opencode.json');
  const snippet = createOpenCodeSnippet(projectRoot);

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

function writeCodexConfig(projectRoot: string, force: boolean): { path: string; changed: boolean } {
  const codexDir = join(projectRoot, '.codex');
  const codexConfigPath = join(codexDir, 'config.toml');
  ensureDir(codexDir);

  const snippet = createCodexTomlSnippet(projectRoot);

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

function printHarnessSnippet(projectRoot: string, tool: HarnessTool): void {
  const target = tool === 'opencode'
    ? 'opencode.json'
    : isMcpJsonTool(tool)
    ? '.mcp.json'
    : tool === 'codex'
      ? '.codex/config.toml'
      : 'your tool MCP config';
  console.log(`\nHarness MCP config snippet for ${tool} (${target}):\n`);
  if (tool === 'codex') {
    console.log(createCodexTomlSnippet(projectRoot));
  } else if (tool === 'opencode') {
    console.log(JSON.stringify(createOpenCodeSnippet(projectRoot), null, 2));
  } else {
    console.log(JSON.stringify(createMcpJsonSnippet(projectRoot), null, 2));
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
    '2. Build the agent prompt from `context.agent.role_summary`, `context.agent.constraints`, and `context.development_evals.harness_prompt_block`.',
    '3. Use `odin.get_development_eval_status({ feature_id })` when you need focused eval state instead of parsing broad status payloads.',
    '4. Record structured eval artifacts with `odin.record_eval_plan`, `odin.record_eval_run`, and `odin.record_quality_gate`.',
    '5. Never treat Development Evals as a replacement for `odin.verify_design`, `odin.run_review_checks`, tests, runtime verification, or watcher checks.',
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
  const mcpSnippet = createMcpJsonSnippet(options.projectRoot);

  console.log('Odin runtime project bootstrap complete.');
  console.log(`- ${config.changed ? 'wrote' : 'kept'} ${config.path}`);
  console.log(`- ${envExample.changed ? 'updated' : 'kept'} ${envExample.path}`);

  if (options.writeMcp && isMcpJsonTool(options.tool)) {
    const mcp = writeMcpFile(options.projectRoot, mcpSnippet, options.force);
    console.log(`- ${mcp.changed ? 'updated' : 'kept'} ${mcp.path}`);
  }

  if (options.writeMcp && options.tool === 'opencode') {
    const openCodeConfig = writeOpenCodeConfig(options.projectRoot, options.force);
    console.log(`- ${openCodeConfig.changed ? 'updated' : 'kept'} ${openCodeConfig.path}`);
  }

  if (options.writeMcp && options.tool === 'codex') {
    const codexConfig = writeCodexConfig(options.projectRoot, options.force);
    console.log(`- ${codexConfig.changed ? 'updated' : 'kept'} ${codexConfig.path}`);
  }

  console.log('\nNext steps:');
  console.log('1. Copy .env.example to .env and fill in your Supabase values');
  if (options.writeMcp) {
    console.log('2. Review the generated harness config and confirm it matches your local setup');
  } else {
    console.log('2. Add the printed MCP snippet to your harness config');
  }
  console.log('3. Start using Odin — your AI agent now has workflow tools available');

  printHarnessSnippet(options.projectRoot, options.tool);
}

main();
