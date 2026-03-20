/**
 * Prepare Phase Context Tool
 * Version: 0.1.0
 */

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import { getPhaseAgentInstructions, getPhaseContract, isWatchedPhase } from '../domain/phases.js';
import { computeResonance, type ResonanceInput } from '../domain/resonance.js';
import type { PreparePhaseContextInput } from '../schemas.js';
import type { ArtifactOutputType, LearningCategory, PhaseArtifact, PhaseContextBundle } from '../types.js';
import { createErrorResult, createTextResult } from '../utils.js';

const ARTIFACT_KEYS: ArtifactOutputType[] = [
  'prd',
  'requirements',
  'spec',
  'tasks',
  'review',
  'documentation',
  'release_notes',
  'design_verification',
];

function buildArtifactLineage(artifacts: PhaseArtifact[]): PhaseContextBundle['artifacts'] {
  const lineage: PhaseContextBundle['artifacts'] = {};

  for (const output_type of ARTIFACT_KEYS) {
    const matching = artifacts.filter((artifact) => artifact.output_type === output_type);
    const latest = matching.at(-1);
    if (latest != null) {
      lineage[output_type] = latest;
    }
  }

  return lineage;
}

export async function handlePreparePhaseContext(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  input: PreparePhaseContextInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const artifacts = input.include_artifacts ? await adapter.listPhaseArtifacts(input.feature_id) : [];
  const [feature_learnings, related_learnings] = input.include_learnings
    ? await Promise.all([
        adapter.listLearnings(input.feature_id),
        adapter.listRelatedLearnings(input.feature_id, 5),
      ])
    : [[], []];
  const [open_blockers, open_gates, open_findings, pending_claims] = await Promise.all([
    adapter.listOpenBlockers(input.feature_id),
    adapter.listOpenGates(input.feature_id),
    adapter.listOpenFindings(input.feature_id),
    adapter.listPendingClaims(input.feature_id),
  ]);
  const phase = getPhaseContract(input.phase);
  const agent = getPhaseAgentInstructions(input.phase);
  const actor_name = resolveWorkflowActorName(input.phase, input.agent_name ?? agent.name);
  const resolved_skills = input.include_skills
    ? await skill_adapter.resolveSkills({ feature, artifacts, phase: input.phase })
    : { resolved: [], fallback_used: false };
  const skill_paths = resolved_skills.resolved.map((skill) => `${skill.category}/${skill.name}`);
  const existing_invocation = await adapter.findOpenAgentInvocation(feature.id, input.phase, actor_name);
  const invocation =
    existing_invocation ??
    (input.phase === '10'
      ? null
      : await adapter.startAgentInvocation(
          feature.id,
          input.phase,
          actor_name,
          `Phase ${input.phase}: ${phase.name}`,
          skill_paths.length > 0 ? skill_paths : undefined
        ));

  const bundle: PhaseContextBundle = {
    feature,
    phase,
    agent: {
      ...agent,
      name: actor_name,
    },
    invocation:
      invocation == null
        ? null
        : {
            id: invocation.id,
            agent_name: invocation.agent_name,
            started_at: invocation.started_at,
            skills_used: invocation.skills_used,
          },
    workflow: {
      open_blockers,
      open_gates,
      open_findings,
      pending_claims,
    },
    artifacts: buildArtifactLineage(artifacts),
    skills: {
      resolved: resolved_skills.resolved,
      fallback_used: resolved_skills.fallback_used,
    },
    verification: {
      watched_phase: isWatchedPhase(input.phase),
      required_claims: isWatchedPhase(input.phase) ? ['CODE_MODIFIED'] : [],
      required_checks:
        input.phase === '6'
          ? ['security review', 'unit test evaluation']
          : isWatchedPhase(input.phase)
            ? ['build', 'tests']
            : [],
      review_mode: input.phase === '6' ? 'security' : isWatchedPhase(input.phase) ? 'watched_phase' : 'none',
    },
    learnings: [
      ...feature_learnings.map((learning) => ({
        id: learning.id,
        title: learning.title,
        category: learning.category,
        summary: learning.content.slice(0, 200),
        source: 'feature' as const,
      })),
      ...(() => {
        const resonance_inputs: ResonanceInput[] = related_learnings.map((l) => ({
          id: l.id,
          category: l.category,
          confidence_score: l.confidence_score,
          source_feature_id: l.source_feature_id,
          shared_domains: l.shared_domains,
          created_at: new Date().toISOString(),
        }));
        const scores = computeResonance(resonance_inputs);
        const score_map = new Map(scores.map((s) => [s.learning_id, s.combined]));

        return related_learnings
          .slice()
          .sort((a, b) => (score_map.get(b.id) ?? 0) - (score_map.get(a.id) ?? 0))
          .map((learning) => ({
            id: learning.id,
            title: learning.title,
            category: learning.category as LearningCategory,
            summary: learning.content.slice(0, 200),
            source: 'related' as const,
            source_feature_id: learning.source_feature_id,
            shared_domains: learning.shared_domains,
          }));
      })(),
    ],
  };

  return createTextResult(
    `Prepared ${phase.name} context for feature ${feature.id}.`,
    { context: bundle }
  );
}
