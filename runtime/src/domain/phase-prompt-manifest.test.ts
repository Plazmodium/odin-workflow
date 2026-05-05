import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { computeStaticPhasePromptHashes } from './phase-prompt-manifest.js';

const createdDirs: string[] = [];
const originalProjectRoot = process.env.ODIN_PROJECT_ROOT;

function createProjectDefinitions(sharedContext: string, builder: string): string {
  const root = mkdtempSync(join(tmpdir(), 'odin-manifest-root-'));
  createdDirs.push(root);
  const definitionsRoot = join(root, '.odin', 'agents', 'definitions');
  mkdirSync(definitionsRoot, { recursive: true });
  writeFileSync(join(definitionsRoot, '_shared-context.md'), sharedContext, 'utf8');
  writeFileSync(join(definitionsRoot, 'builder.md'), builder, 'utf8');
  return root;
}

function expectedTextHash(text: string): string {
  return createHash('sha256').update(JSON.stringify(text.replace(/\r\n/g, '\n'))).digest('hex');
}

afterEach(() => {
  if (originalProjectRoot == null) {
    delete process.env.ODIN_PROJECT_ROOT;
  } else {
    process.env.ODIN_PROJECT_ROOT = originalProjectRoot;
  }

  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('computeStaticPhasePromptHashes', () => {
  it('prefers target project .odin agent definitions over source checkout definitions', async () => {
    const sharedContext = 'project-local shared context\n';
    const builder = 'project-local builder definition\n';
    process.env.ODIN_PROJECT_ROOT = createProjectDefinitions(sharedContext, builder);

    const hashes = await computeStaticPhasePromptHashes('5');

    expect(hashes.shared_context_hash).toBe(expectedTextHash(sharedContext));
    expect(hashes.phase_definition_hash).toBe(expectedTextHash(builder));
  });
});
