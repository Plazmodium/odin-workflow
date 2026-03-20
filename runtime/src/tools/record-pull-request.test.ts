import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { handleRecordPullRequest } from './record-pull-request.js';

describe('handleRecordPullRequest', () => {
  it('records PR metadata for an existing feature', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-PR' })),
      recordPullRequest: vi.fn(async () => ({
        feature_id: 'FEAT-PR',
        pr_url: 'https://github.com/org/repo/pull/42',
        pr_number: 42,
      })),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPullRequest(adapter, {
      feature_id: 'FEAT-PR',
      pr_url: 'https://github.com/org/repo/pull/42',
      pr_number: 42,
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordPullRequest).toHaveBeenCalledWith(
      'FEAT-PR',
      'https://github.com/org/repo/pull/42',
      42
    );
  });
});
