import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import { assessPhaseExecutionPolicy } from '../domain/execution-policy.js';
import { assessPromptRealizationPolicy } from '../domain/prompt-realization.js';
import type { FeatureRecord, PhaseId } from '../types.js';
import type { ToolResult } from '../utils.js';
import { createErrorResult } from '../utils.js';
import { buildPhaseContextBundleForFeature } from './prepare-phase-context.js';

export async function assessStrictPhaseAgentPrework(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  config: RuntimeConfig,
  feature: FeatureRecord,
  phase: PhaseId,
  actor_name: string,
  operation: 'record phase artifact' | 'submit claim' | 'run review checks',
): Promise<ToolResult | null> {
  if (config.attestation?.mode !== 'strict') {
    return null;
  }

  const [expected_bundle, execution_attestation, prompt_realization] = await Promise.all([
    buildPhaseContextBundleForFeature(feature, adapter, skill_adapter, config, {
      feature_id: feature.id,
      phase,
      agent_name: actor_name,
      include_artifacts: true,
      include_skills: true,
      include_learnings: true,
    }, { open_invocation: false }),
    adapter.getPhaseExecutionAttestation(feature.id, phase),
    adapter.getPhasePromptRealization(feature.id, phase),
  ]);
  const execution_assessment = assessPhaseExecutionPolicy(phase, execution_attestation, config.attestation);
  const prompt_realization_assessment = assessPromptRealizationPolicy(
    phase,
    expected_bundle.execution.phase_prompt_manifest,
    prompt_realization,
    config.attestation,
  );

  if (execution_assessment.error != null) {
    return createErrorResult(
      `Strict mode cannot ${operation} for phase ${phase} before canonical phase-agent execution is proven. ${execution_assessment.error}`,
      {
        feature_id: feature.id,
        phase,
        operation,
        execution: execution_assessment.row,
        recovery: 'Invoke the canonical Odin phase agent in a distinct worker session, record odin.register_phase_execution, record odin.register_phase_realization, then retry this write.',
      },
    );
  }

  if (prompt_realization_assessment.error != null) {
    return createErrorResult(
      `Strict mode cannot ${operation} for phase ${phase} before canonical phase-agent prompt realization is proven. ${prompt_realization_assessment.error}`,
      {
        feature_id: feature.id,
        phase,
        operation,
        prompt_realization: prompt_realization_assessment.row,
        recovery: 'Build the worker prompt from odin.prepare_phase_context, include the canonical phase definition and resolved skills, record odin.register_phase_realization, then retry this write.',
      },
    );
  }

  return null;
}
