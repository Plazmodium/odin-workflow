import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { handleRecordWatcherReview } from './record-watcher-review.js';

describe('handleRecordWatcherReview', () => {
  it('normalizes harness labels to watcher-agent', async () => {
    const adapter: WorkflowStateAdapter = {
      recordWatcherReview: vi.fn(async (review) => ({
        id: 'review_1',
        reviewed_at: '2026-03-20T16:15:00.000Z',
        ...review,
      })),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordWatcherReview(adapter, {
      claim_id: '550e8400-e29b-41d4-a716-446655440000',
      verdict: 'PASS',
      reasoning: 'Claim matches the supplied evidence.',
      watcher_agent: 'opencode',
      confidence: 0.91,
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordWatcherReview).toHaveBeenCalledWith({
      claim_id: '550e8400-e29b-41d4-a716-446655440000',
      verdict: 'PASS',
      confidence: 0.91,
      reasoning: 'Claim matches the supplied evidence.',
      watcher_agent: 'watcher-agent',
    });
  });
});
