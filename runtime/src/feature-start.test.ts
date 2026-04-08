import { describe, expect, it, vi } from 'vitest';

import type { FeatureRecord } from './types.js';
import { executeStartFeatureFlow, parseArgs, type FeatureStartClient, type GitWorkspaceManager } from './feature-start.js';

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'AUTH-001',
    name: 'Login',
    status: 'IN_PROGRESS',
    current_phase: '0',
    complexity_level: 2,
    severity: 'ROUTINE',
    branch_name: 'jd/feature/AUTH-001',
    base_branch: 'main',
    author: 'Jane Doe',
    created_at: '2026-04-08T00:00:00.000Z',
    updated_at: '2026-04-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('parseArgs', () => {
  it('parses the required feature-start options', () => {
    const parsed = parseArgs([
      '--project-root',
      '/tmp/project',
      '--id',
      'AUTH-001',
      '--name',
      'Login',
      '--complexity-level',
      '2',
      '--severity',
      'ROUTINE',
      '--author',
      'Jane Doe',
      '--dev-initials',
      'jd',
    ]);

    expect(parsed).toMatchObject({
      projectRoot: '/tmp/project',
      id: 'AUTH-001',
      name: 'Login',
      complexity_level: 2,
      severity: 'ROUTINE',
      author: 'Jane Doe',
      dev_initials: 'jd',
      base_branch: 'main',
      help: false,
    });
  });
});

describe('executeStartFeatureFlow', () => {
  it('creates the branch before recording the feature', async () => {
    const events: string[] = [];
    const git: GitWorkspaceManager = {
      prepareFeatureBranch: vi.fn(async () => {
        events.push('git');
        return 'created' as const;
      }),
    };
    const client: FeatureStartClient = {
      startFeature: vi.fn(async () => {
        events.push('start_feature');
        return createFeature();
      }),
      close: vi.fn(async () => undefined),
    };

    const result = await executeStartFeatureFlow(
      {
        projectRoot: '/tmp/project',
        id: 'AUTH-001',
        name: 'Login',
        complexity_level: 2,
        severity: 'ROUTINE',
        author: 'Jane Doe',
        dev_initials: 'jd',
        base_branch: 'main',
        help: false,
      },
      git,
      client,
    );

    expect(events).toEqual(['git', 'start_feature']);
    expect(git.prepareFeatureBranch).toHaveBeenCalledWith('/tmp/project', 'jd/feature/AUTH-001', 'main');
    expect(client.startFeature).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'AUTH-001', dev_initials: 'jd', base_branch: 'main' }),
    );
    expect(result).toMatchObject({
      branch_name: 'jd/feature/AUTH-001',
      branch_action: 'created',
    });
  });

  it('does not record the feature if branch preparation fails', async () => {
    const git: GitWorkspaceManager = {
      prepareFeatureBranch: vi.fn(async () => {
        throw new Error('git switch failed');
      }),
    };
    const client: FeatureStartClient = {
      startFeature: vi.fn(async () => createFeature()),
      close: vi.fn(async () => undefined),
    };

    await expect(
      executeStartFeatureFlow(
        {
          projectRoot: '/tmp/project',
          id: 'AUTH-001',
          name: 'Login',
          complexity_level: 2,
          severity: 'ROUTINE',
          author: 'Jane Doe',
          dev_initials: 'jd',
          base_branch: 'main',
          help: false,
        },
        git,
        client,
      ),
    ).rejects.toThrow('git switch failed');

    expect(client.startFeature).not.toHaveBeenCalled();
  });
});
