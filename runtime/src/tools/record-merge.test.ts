import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { handleRecordMerge } from './record-merge.js';

describe('handleRecordMerge', () => {
  it('records merge metadata for an existing feature', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-MERGE' })),
      recordMerge: vi.fn(async () => ({
        feature_id: 'FEAT-MERGE',
        merged_at: '2026-03-20T15:30:00.000Z',
        merged_by: 'human',
        pr_url: 'https://github.com/org/repo/pull/42',
        pr_number: 42,
      })),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordMerge(adapter, {
      feature_id: 'FEAT-MERGE',
      merged_by: 'human',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordMerge).toHaveBeenCalledWith('FEAT-MERGE', 'human');
    expect(result.structuredContent?.merge).toMatchObject({
      feature_id: 'FEAT-MERGE',
      merged_by: 'human',
    });
  });
});
