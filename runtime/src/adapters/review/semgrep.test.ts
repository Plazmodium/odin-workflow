import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { SemgrepReviewAdapter } from './semgrep.js';

let tempDir: string | null = null;

async function createTempDir(): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), 'odin-review-'));
  return tempDir;
}

afterEach(async () => {
  if (tempDir != null) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('SemgrepReviewAdapter docs_process profile', () => {
  it('passes with no findings when no changed files are provided', async () => {
    const root = await createTempDir();
    const adapter = new SemgrepReviewAdapter(root);

    const result = await adapter.runChecks({
      feature_id: 'FEAT-DOCS',
      tool: 'docs_process',
      changed_files: [],
    });

    expect(result.tool).toBe('docs_process');
    expect(result.status).toBe('passed');
    expect(result.findings).toEqual([]);
  });

  it('checks markdown links and command placeholders without invoking semgrep', async () => {
    const root = await createTempDir();
    await mkdir(join(root, 'docs'), { recursive: true });
    await writeFile(join(root, 'docs/guide.md'), '[Missing](missing.md)\nRun `npm run <script>`\n', 'utf8');
    const adapter = new SemgrepReviewAdapter(root);

    const result = await adapter.runChecks({
      feature_id: 'FEAT-DOCS',
      tool: 'docs_process',
      changed_files: ['docs/guide.md'],
    });

    expect(result.tool).toBe('docs_process');
    expect(result.status).toBe('failed');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule_id: 'docs-process/broken-local-link' }),
        expect.objectContaining({ rule_id: 'docs-process/placeholder-command' }),
      ]),
    );
  });

  it('ignores markdown links that use explicit URI schemes', async () => {
    const root = await createTempDir();
    await mkdir(join(root, 'docs'), { recursive: true });
    await writeFile(join(root, 'docs/guide.md'), '[Email](mailto:user@example.com)\n[Phone](tel:+15555550123)\n', 'utf8');
    const adapter = new SemgrepReviewAdapter(root);

    const result = await adapter.runChecks({
      feature_id: 'FEAT-DOCS',
      tool: 'docs_process',
      changed_files: ['docs/guide.md'],
    });

    expect(result.status).toBe('passed');
    expect(result.findings).toEqual([]);
  });
});
