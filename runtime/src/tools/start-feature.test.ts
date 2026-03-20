import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { FeatureRecord } from '../types.js';
import { handleStartFeature } from './start-feature.js';

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-100',
    name: 'Test Feature',
    status: 'PLANNED',
    current_phase: '0',
    complexity_level: 1,
    severity: 'ROUTINE',
    author: 'Jane Doe',
    created_at: '2026-03-20T00:00:00.000Z',
    updated_at: '2026-03-20T00:00:00.000Z',
    ...overrides,
  };
}

function createAdapter(feature: FeatureRecord): WorkflowStateAdapter {
  return {
    startFeature: vi.fn(async () => feature),
  } as unknown as WorkflowStateAdapter;
}

describe('handleStartFeature', () => {
  it('rejects harness-style author names', async () => {
    const result = await handleStartFeature(createAdapter(createFeature()), {
      id: 'FEAT-100',
      name: 'Test Feature',
      complexity_level: 1,
      severity: 'ROUTINE',
      author: 'opencode',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('real human name');
  });

  it('starts a feature with a valid human author', async () => {
    const result = await handleStartFeature(
      createAdapter(createFeature({ branch_name: 'jd/feature/FEAT-100' })),
      {
        id: 'FEAT-100',
        name: 'Test Feature',
        complexity_level: 1,
        severity: 'ROUTINE',
        author: 'Jane Doe',
        dev_initials: 'jd',
      }
    );

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.feature).toMatchObject({
      id: 'FEAT-100',
      author: 'Jane Doe',
    });
  });
});
