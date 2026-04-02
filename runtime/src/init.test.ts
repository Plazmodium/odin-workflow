import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

function createTmpDir(): string {
  const dir = join(tmpdir(), `odin-init-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function runInit(args: string): string {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const initScript = join(testDir, '..', 'dist', 'init.js');
  return execSync(`node ${initScript} ${args}`, { encoding: 'utf8', timeout: 10000 });
}

describe('odin-runtime-init', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .odin/config.yaml, .odin/skills/.gitkeep, packaged guidance, and .env.example', () => {
    const output = runInit(`--project-root ${tmpDir}`);

    expect(existsSync(join(tmpDir, '.odin', 'config.yaml'))).toBe(true);
    expect(existsSync(join(tmpDir, '.odin', 'skills', '.gitkeep'))).toBe(true);
    expect(existsSync(join(tmpDir, '.odin', 'ODIN.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.odin', 'agents', 'definitions', '_shared-context.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.odin', 'agents', 'definitions', 'builder.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.env.example'))).toBe(true);
    expect(output).toContain('Odin runtime project bootstrap complete');
    expect(output).toContain('runtime quick-start mode: in_memory');
    expect(output).toContain('odin.get_development_eval_status');
    expect(output).toContain('Canonical eval-aware orchestration snippet');
    expect(output).toContain('odin.record_eval_plan');
    expect(output).toContain('.odin/ODIN.md');

    const config = readFileSync(join(tmpDir, '.odin', 'config.yaml'), 'utf8');
    expect(config).toContain('mode: in_memory');
    expect(config).toContain('provider: none');
    expect(config).toContain('automation:');
    expect(config).toContain('mode: guarded');

    const odinGuide = readFileSync(join(tmpDir, '.odin', 'ODIN.md'), 'utf8');
    expect(odinGuide).toContain('# Odin');
  });

  it('does not overwrite existing config without --force', () => {
    const configDir = join(tmpDir, '.odin');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.yaml'), 'custom: true\n', 'utf8');

    runInit(`--project-root ${tmpDir}`);

    const content = readFileSync(join(configDir, 'config.yaml'), 'utf8');
    expect(content).toBe('custom: true\n');
  });

  it('overwrites existing config with --force', () => {
    const configDir = join(tmpDir, '.odin');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.yaml'), 'custom: true\n', 'utf8');

    runInit(`--project-root ${tmpDir} --force`);

    const content = readFileSync(join(configDir, 'config.yaml'), 'utf8');
    expect(content).toContain('runtime:');
    expect(content).not.toContain('custom: true');
  });

  it('appends missing env vars to existing .env.example', () => {
    writeFileSync(join(tmpDir, '.env.example'), 'MY_VAR=hello\n', 'utf8');

    runInit(`--project-root ${tmpDir}`);

    const content = readFileSync(join(tmpDir, '.env.example'), 'utf8');
    expect(content).toContain('MY_VAR=hello');
    expect(content).toContain('DATABASE_URL=');
    expect(content).toContain('SUPABASE_URL=');
    expect(content).toContain('SUPABASE_SECRET_KEY=');
  });

  it('writes .mcp.json with --tool amp --write-mcp', () => {
    runInit(`--project-root ${tmpDir} --tool amp --write-mcp`);

    expect(existsSync(join(tmpDir, '.mcp.json'))).toBe(true);
    const mcp = JSON.parse(readFileSync(join(tmpDir, '.mcp.json'), 'utf8'));
    expect(mcp.mcpServers.odin).toBeDefined();
    expect(mcp.mcpServers.odin.command).toBe('npx');
    expect(mcp.mcpServers.odin.args).toEqual(['-y', '@plazmodium/odin', 'mcp']);
  });

  it('writes opencode.json with --tool opencode --write-mcp', () => {
    runInit(`--project-root ${tmpDir} --tool opencode --write-mcp`);

    expect(existsSync(join(tmpDir, 'opencode.json'))).toBe(true);
    const config = JSON.parse(readFileSync(join(tmpDir, 'opencode.json'), 'utf8'));
    expect(config.$schema).toBe('https://opencode.ai/config.json');
    expect(config.mcp.odin).toBeDefined();
    expect(config.mcp.odin.type).toBe('local');
    expect(config.mcp.odin.command[0]).toBe('npx');
    expect(config.mcp.odin.command.slice(1)).toEqual(['-y', '@plazmodium/odin', 'mcp']);
    expect(config.mcp.odin.environment.ODIN_PROJECT_ROOT).toBe(tmpDir);
  });

  it('can emit source-checkout snippets for local development', () => {
    runInit(`--project-root ${tmpDir} --tool amp --distribution source --write-mcp`);

    const mcp = JSON.parse(readFileSync(join(tmpDir, '.mcp.json'), 'utf8'));
    expect(mcp.mcpServers.odin.command).toBe('node');
    expect(mcp.mcpServers.odin.args[0]).toContain('dist/server.js');
  });

  it('writes .codex/config.toml with --tool codex --write-mcp', () => {
    runInit(`--project-root ${tmpDir} --tool codex --write-mcp`);

    expect(existsSync(join(tmpDir, '.codex', 'config.toml'))).toBe(true);
    const content = readFileSync(join(tmpDir, '.codex', 'config.toml'), 'utf8');
    expect(content).toContain('[mcp_servers.odin]');
  });

  it('prints help with --help', () => {
    const output = runInit('--help');
    expect(output).toContain('Usage: odin init');
    expect(output).toContain('--project-root');
    expect(output).toContain('--tool');
    expect(output).toContain('--distribution');
  });

  it('merges into existing .mcp.json without clobbering other servers', () => {
    const existing = { mcpServers: { other: { command: 'other-cmd', args: [] } } };
    writeFileSync(join(tmpDir, '.mcp.json'), JSON.stringify(existing, null, 2), 'utf8');

    runInit(`--project-root ${tmpDir} --tool amp --write-mcp`);

    const mcp = JSON.parse(readFileSync(join(tmpDir, '.mcp.json'), 'utf8'));
    expect(mcp.mcpServers.other).toBeDefined();
    expect(mcp.mcpServers.odin).toBeDefined();
  });

  it('merges into existing opencode.json without clobbering other config', () => {
    const existing = {
      $schema: 'https://opencode.ai/config.json',
      model: 'anthropic/claude-sonnet-4-5',
      mcp: {
        other: {
          type: 'local',
          command: ['npx', '-y', '@modelcontextprotocol/server-everything'],
        },
      },
    };
    writeFileSync(join(tmpDir, 'opencode.json'), JSON.stringify(existing, null, 2), 'utf8');

    runInit(`--project-root ${tmpDir} --tool opencode --write-mcp`);

    const config = JSON.parse(readFileSync(join(tmpDir, 'opencode.json'), 'utf8'));
    expect(config.model).toBe('anthropic/claude-sonnet-4-5');
    expect(config.mcp.other).toBeDefined();
    expect(config.mcp.odin).toBeDefined();
  });
});
