/**
 * Capture Learning Tool
 * Version: 0.2.0
 */

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { matchDomains } from '../domain/matching.js';
import type { CaptureLearningInput } from '../schemas.js';
import type { DomainMatch } from '../types.js';
import { createErrorResult, createId, createTextResult } from '../utils.js';

function formatMatchSummary(match: DomainMatch) {
  return {
    name: match.domain.name,
    target_type: match.domain.target_type,
    target_path: match.domain.target_path,
    relevance: Math.round(match.relevance * 100) / 100,
    strong_matches: match.strong_matches,
    weak_matches: match.weak_matches,
  };
}

export async function handleCaptureLearning(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  input: CaptureLearningInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const learning = await adapter.captureLearning({
    id: createId('learning'),
    feature_id: input.feature_id,
    phase: input.phase,
    title: input.title,
    content: input.content,
    category: input.category,
    tags: input.domain_tags,
    created_by: input.created_by,
    created_at: new Date().toISOString(),
  });

  let persisted_domains: ReturnType<typeof formatMatchSummary>[] = [];
  let suggested_domains: ReturnType<typeof formatMatchSummary>[] = [];

  if (input.domain_tags.length > 0) {
    const domains = await skill_adapter.listKnowledgeDomains();
    const matches = matchDomains(input.domain_tags, domains);

    const persisted_matches = matches.filter((m) => m.persisted);
    const suggested_matches = matches.filter((m) => !m.persisted);

    for (const match of persisted_matches) {
      await adapter.declarePropagationTarget(
        learning.id,
        match.domain.target_type,
        match.domain.target_path,
        match.relevance
      );
    }

    persisted_domains = persisted_matches.map(formatMatchSummary);
    suggested_domains = suggested_matches.map(formatMatchSummary);
  }

  return createTextResult(
    `Captured ${learning.category} learning for feature ${learning.feature_id}.` +
      (persisted_domains.length > 0
        ? ` Auto-declared ${persisted_domains.length} propagation target(s).`
        : ''),
    { learning, persisted_domains, suggested_domains }
  );
}
