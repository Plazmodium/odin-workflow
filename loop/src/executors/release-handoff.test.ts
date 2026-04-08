import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { ensureFeatureBranchReady } from './release-handoff.js';

function createGitRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'ralph-release-'));
  execFileSync('git', ['init', '-b', 'main'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Ralph Test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'ralph@example.com'], { cwd: repo });
  writeFileSync(join(repo, 'README.md'), '# test\n', 'utf8');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: repo });
  return repo;
}

describe('ensureFeatureBranchReady', () => {
  it('fails when the recorded branch does not exist locally', async () => {
    const repo = createGitRepo();

    try {
      await expect(ensureFeatureBranchReady(repo, 'gr/feature/OPS-001')).rejects.toThrow(
        'recorded feature branch gr/feature/OPS-001 does not exist locally',
      );
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('fails when the current branch does not match the recorded branch', async () => {
    const repo = createGitRepo();

    try {
      execFileSync('git', ['switch', '-c', 'gr/feature/OPS-001'], { cwd: repo });
      execFileSync('git', ['switch', 'main'], { cwd: repo });

      await expect(ensureFeatureBranchReady(repo, 'gr/feature/OPS-001')).rejects.toThrow(
        'current branch is main, but Odin recorded gr/feature/OPS-001',
      );
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('passes when the recorded branch exists and is checked out', async () => {
    const repo = createGitRepo();

    try {
      execFileSync('git', ['switch', '-c', 'gr/feature/OPS-001'], { cwd: repo });

      await expect(ensureFeatureBranchReady(repo, 'gr/feature/OPS-001')).resolves.toBeUndefined();
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
