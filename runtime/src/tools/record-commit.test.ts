import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { handleRecordCommit } from './record-commit.js';

describe('handleRecordCommit', () => {
  it('records commit metadata for an existing feature and normalizes harness labels', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-COMMIT' })),
      recordCommit: vi.fn(async (commit) => ({
        ...commit,
        committed_at: '2026-03-20T16:00:00.000Z',
      })),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordCommit(adapter, {
      feature_id: 'FEAT-COMMIT',
      commit_hash: 'abc123',
      phase: '5',
      message: 'feat: add tests',
      files_changed: 3,
      insertions: 42,
      deletions: 5,
      committed_by: 'opencode',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordCommit).toHaveBeenCalledWith({
      feature_id: 'FEAT-COMMIT',
      commit_hash: 'abc123',
      phase: '5',
      message: 'feat: add tests',
      files_changed: 3,
      insertions: 42,
      deletions: 5,
      committed_by: 'builder-agent',
    });
  });
});
