/**
 * Start Feature Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { StartFeatureInput } from '../schemas.js';
import { createTextResult } from '../utils.js';

export async function handleStartFeature(
  adapter: WorkflowStateAdapter,
  input: StartFeatureInput
) {
  const branch_name =
    input.dev_initials == null ? undefined : `${input.dev_initials}/feature/${input.id}`;

  const feature = await adapter.startFeature({
    id: input.id,
    name: input.name,
    complexity_level: input.complexity_level,
    severity: input.severity,
    requirements_path: input.requirements_path,
    dev_initials: input.dev_initials,
    branch_name,
    base_branch: input.base_branch,
    author: input.author,
  });

  return createTextResult(
    `Feature ${feature.id} started at phase ${feature.current_phase} (${feature.status}).`,
    {
      feature,
      next_phase: '1',
      next_phase_name: 'Product',
    }
  );
}
