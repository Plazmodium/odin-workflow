import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PhaseId } from './types.js';

const AGENT_DEFINITION_FILE_BY_PHASE: Partial<Record<PhaseId, string>> = {
  '0': 'planning.md',
  '1': 'product.md',
  '2': 'discovery.md',
  '3': 'architect.md',
  '4': 'guardian.md',
  '5': 'builder.md',
  '6': 'reviewer.md',
  '7': 'integrator.md',
  '8': 'documenter.md',
  '9': 'release.md',
};

function getPackageRoot(metaUrl: string): string {
  const currentFile = fileURLToPath(metaUrl);
  return resolve(dirname(currentFile), '..');
}

export function getBundledOdinGuidePath(metaUrl: string = import.meta.url): string | null {
  const packageRoot = getPackageRoot(metaUrl);
  const candidates = [join(packageRoot, 'builtin', 'ODIN.md'), join(packageRoot, '..', 'ODIN.md')];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function getBuiltInSkillRoots(metaUrl: string = import.meta.url): string[] {
  const packageRoot = getPackageRoot(metaUrl);
  const bundledRoot = join(packageRoot, 'builtin', 'skills');
  if (existsSync(bundledRoot)) {
    return [bundledRoot];
  }

  const candidates: string[] = [];

  let cursor = packageRoot;
  for (let depth = 0; depth < 5; depth += 1) {
    candidates.push(join(cursor, 'skills'));
    candidates.push(join(cursor, 'agents', 'skills'));

    const parent = resolve(cursor, '..');
    if (parent === cursor) {
      break;
    }

    cursor = parent;
  }

  return candidates.filter((path, index, values) => existsSync(path) && values.indexOf(path) === index);
}

function getBuiltInAgentDefinitionRoots(metaUrl: string = import.meta.url): string[] {
  const packageRoot = getPackageRoot(metaUrl);
  const bundledRoot = join(packageRoot, 'builtin', 'agent-definitions');
  if (existsSync(bundledRoot)) {
    return [bundledRoot];
  }

  const candidates: string[] = [];

  let cursor = packageRoot;
  for (let depth = 0; depth < 5; depth += 1) {
    candidates.push(join(cursor, 'agents', 'definitions'));

    const parent = resolve(cursor, '..');
    if (parent === cursor) {
      break;
    }

    cursor = parent;
  }

  return candidates.filter((path, index, values) => existsSync(path) && values.indexOf(path) === index);
}

export function loadBuiltInAgentDefinition(
  phase: PhaseId,
  metaUrl: string = import.meta.url,
): { markdown: string; source_path: string } | null {
  const phaseFile = AGENT_DEFINITION_FILE_BY_PHASE[phase];
  if (phaseFile == null) {
    return null;
  }

  for (const root of getBuiltInAgentDefinitionRoots(metaUrl)) {
    const definitionPath = join(root, phaseFile);
    if (!existsSync(definitionPath)) {
      continue;
    }

    const sharedContextPath = join(root, '_shared-context.md');
    const parts: string[] = [];
    if (existsSync(sharedContextPath)) {
      parts.push(readFileSync(sharedContextPath, 'utf8').trim());
    }
    parts.push(readFileSync(definitionPath, 'utf8').trim());

    return {
      markdown: `${parts.join('\n\n---\n\n')}\n`,
      source_path: definitionPath,
    };
  }

  return null;
}
