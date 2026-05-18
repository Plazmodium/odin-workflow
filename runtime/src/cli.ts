#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type OdinCommand = 'mcp' | 'init' | 'start-feature';

function printHelp(): void {
  console.log([
    'Usage: odin <command> [options]',
    '',
    'Commands:',
    '  mcp     Start the Odin MCP server',
    '  init           Bootstrap .odin config and MCP wiring for a project',
    '  start-feature  Create/switch the feature branch, then record the feature in Odin',
    '',
    'Examples:',
    '  odin mcp',
    '  odin init --tool opencode --write-mcp',
    '  pnpm dlx @plazmodium/odin mcp',
  ].join('\n'));
}

function resolveCommandTarget(command: OdinCommand): string {
  const currentFile = fileURLToPath(import.meta.url);
  const distDir = dirname(currentFile);

  if (command === 'mcp') {
    return join(distDir, 'server.js');
  }

  if (command === 'start-feature') {
    return join(distDir, 'feature-start.js');
  }

  return join(distDir, 'init.js');
}

function runCommand(command: OdinCommand, forwardedArgs: string[]): void {
  const target = resolveCommandTarget(command);
  const child = spawn(process.execPath, [target, ...forwardedArgs], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal != null) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

const [command, ...forwardedArgs] = process.argv.slice(2);

if (command == null || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

if (command !== 'mcp' && command !== 'init' && command !== 'start-feature') {
  console.error(`Unknown odin command: ${command}`);
  console.error('Run `odin --help` for usage.');
  process.exit(1);
}

runCommand(command, forwardedArgs);
