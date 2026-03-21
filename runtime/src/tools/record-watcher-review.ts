/**
 * Record Watcher Review Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { resolveNamedActorName } from '../domain/actors.js';
import type { RecordWatcherReviewInput } from '../schemas.js';
import { createTextResult } from '../utils.js';

export async function handleRecordWatcherReview(
  adapter: WorkflowStateAdapter,
  input: RecordWatcherReviewInput
) {
  const watcher_agent = resolveNamedActorName('watcher-agent', input.watcher_agent);
  const review = await adapter.recordWatcherReview({
    claim_id: input.claim_id,
    verdict: input.verdict,
    confidence: input.confidence,
    reasoning: input.reasoning,
    watcher_agent,
  });

  return createTextResult(
    `Recorded watcher ${review.verdict} review for claim ${review.claim_id}.`,
    { review }
  );
}
