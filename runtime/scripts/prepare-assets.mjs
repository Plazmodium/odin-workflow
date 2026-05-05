import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const runtimeRoot = resolve(scriptDir, '..');
const repoRoot = resolve(runtimeRoot, '..');
const assetsRoot = join(runtimeRoot, 'assets');

rmSync(assetsRoot, { recursive: true, force: true });
mkdirSync(assetsRoot, { recursive: true });

cpSync(join(repoRoot, 'ODIN.md'), join(assetsRoot, 'ODIN.md'));
cpSync(join(repoRoot, 'agents', 'definitions'), join(assetsRoot, 'agents', 'definitions'), { recursive: true });
cpSync(join(repoRoot, 'agents', 'skills'), join(assetsRoot, 'agents', 'skills'), { recursive: true });
