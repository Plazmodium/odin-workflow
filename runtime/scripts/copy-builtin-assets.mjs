#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const scriptsDir = dirname(currentFile);
const runtimeRoot = resolve(scriptsDir, '..');
const repoRoot = resolve(runtimeRoot, '..');
const builtinRoot = join(runtimeRoot, 'builtin');

const requiredSources = [
  join(repoRoot, 'ODIN.md'),
  join(repoRoot, 'agents', 'skills'),
  join(repoRoot, 'agents', 'definitions'),
];

for (const source of requiredSources) {
  if (!existsSync(source)) {
    throw new Error(`Missing required Odin package asset source: ${source}`);
  }
}

rmSync(builtinRoot, { recursive: true, force: true });
mkdirSync(builtinRoot, { recursive: true });

cpSync(join(repoRoot, 'ODIN.md'), join(builtinRoot, 'ODIN.md'));
cpSync(join(repoRoot, 'agents', 'skills'), join(builtinRoot, 'skills'), { recursive: true });
cpSync(join(repoRoot, 'agents', 'definitions'), join(builtinRoot, 'agent-definitions'), { recursive: true });

console.log('Copied bundled Odin assets into runtime/builtin.');
