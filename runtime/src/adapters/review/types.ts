/**
 * Review Adapter Types
 * Version: 0.1.0
 */

import type { ReviewExecutionResult, ReviewTool } from '../../types.js';

export interface RunReviewRequest {
  feature_id: string;
  tool: ReviewTool;
  changed_files: string[];
}

export interface ReviewAdapter {
  runChecks(request: RunReviewRequest): Promise<ReviewExecutionResult>;
}
