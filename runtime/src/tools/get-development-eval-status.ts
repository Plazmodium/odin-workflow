/**
 * Get Development Eval Status Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { buildDevelopmentEvalContext } from '../domain/development-evals.js';
import type { GetDevelopmentEvalStatusInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';

export async function handleGetDevelopmentEvalStatus(
  adapter: WorkflowStateAdapter,
  input: GetDevelopmentEvalStatusInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const [artifacts, open_gate_records] = await Promise.all([
    adapter.listPhaseArtifacts(input.feature_id),
    adapter.listOpenGateRecords(input.feature_id),
  ]);

  const development_evals = buildDevelopmentEvalContext(
    feature,
    feature.current_phase,
    artifacts,
    open_gate_records
  );

  const eval_plans = artifacts.filter((artifact) => artifact.output_type === 'eval_plan');
  const eval_runs = artifacts.filter((artifact) => artifact.output_type === 'eval_run');

  const readiness_gate = development_evals.open_readiness_gate;
  const text_parts = [
    `Development eval mode is ${development_evals.mode}.`,
    development_evals.latest_plan == null ? 'No eval_plan recorded.' : 'Latest eval_plan recorded.',
    development_evals.latest_run == null ? 'No eval_run recorded.' : 'Latest eval_run recorded.',
    readiness_gate == null
      ? 'No open eval_readiness gate.'
      : `Open eval_readiness gate is ${readiness_gate.status}.`,
  ];

  return createTextResult(text_parts.join(' '), {
    feature: {
      id: feature.id,
      name: feature.name,
      current_phase: feature.current_phase,
      status: feature.status,
      complexity_level: feature.complexity_level,
    },
    development_evals,
    history: {
      eval_plan_count: eval_plans.length,
      eval_run_count: eval_runs.length,
      latest_eval_plan: development_evals.latest_plan,
      latest_eval_run: development_evals.latest_run,
      recent_eval_plans: eval_plans.slice(-3),
      recent_eval_runs: eval_runs.slice(-5),
    },
  });
}
