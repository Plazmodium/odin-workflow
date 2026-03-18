/**
 * Explore Knowledge Tool
 * Version: 0.1.0
 */

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { matchDomains, normalizeTerm } from '../domain/matching.js';
import { computeResonance, type ResonanceInput } from '../domain/resonance.js';
import type { ExploreKnowledgeInput } from '../schemas.js';
import type { KnowledgeDomain, LearningRecord } from '../types.js';
import { createTextResult } from '../utils.js';

interface DomainCluster {
  domain_id: string;
  domain_name: string;
  target_type: string;
  target_path: string | null;
  learnings: Array<{
    id: string;
    title: string;
    category: string;
    feature_id: string;
    resonance: number;
  }>;
  density: number;
}

interface KnowledgeBridge {
  learning_id: string;
  learning_title: string;
  domains: string[];
}

export async function handleExploreKnowledge(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  input: ExploreKnowledgeInput
) {
  const domains = await skill_adapter.listKnowledgeDomains();

  // Determine which domains to explore
  let target_domains: KnowledgeDomain[];

  if (input.tags.length > 0) {
    const matches = matchDomains(input.tags, domains);
    target_domains = matches.map((m) => m.domain);

    if (target_domains.length === 0) {
      return createTextResult(
        `No knowledge domains matched tags: [${input.tags.join(', ')}].`,
        {
          clusters: [],
          bridges: [],
          unmatched_tags: input.tags,
          domain_stats: { total_domains: domains.length, explored: 0, total_learnings: 0 },
        }
      );
    }
  } else {
    target_domains = domains;
  }

  // Collect all learnings across all features via the adapter
  const all_learnings = await adapter.listAllLearnings({
    feature_id: input.feature_id,
    category: input.category,
    min_confidence: input.min_confidence,
  });

  // Match each learning's tags against all domains to build clusters
  const domain_learnings = new Map<string, Array<{ learning: LearningRecord; relevance: number }>>();
  const learning_domains = new Map<string, string[]>();

  for (const learning of all_learnings) {
    if (learning.tags.length === 0) continue;

    const matches = matchDomains(learning.tags, target_domains);
    const matched_domain_ids: string[] = [];

    for (const match of matches) {
      if (!match.persisted) continue;
      const existing = domain_learnings.get(match.domain.id) ?? [];
      existing.push({ learning, relevance: match.relevance });
      domain_learnings.set(match.domain.id, existing);
      matched_domain_ids.push(match.domain.id);
    }

    if (matched_domain_ids.length > 0) {
      learning_domains.set(learning.id, matched_domain_ids);
    }
  }

  // Build resonance inputs from learnings that appear in clusters
  const resonance_inputs: ResonanceInput[] = [];
  const seen_ids = new Set<string>();

  for (const entries of domain_learnings.values()) {
    for (const { learning } of entries) {
      if (seen_ids.has(learning.id)) continue;
      seen_ids.add(learning.id);
      resonance_inputs.push({
        id: learning.id,
        category: learning.category,
        confidence_score: 0.8,
        source_feature_id: learning.feature_id,
        shared_domains: learning_domains.get(learning.id) ?? [],
        created_at: learning.created_at,
      });
    }
  }

  const resonance_scores = computeResonance(resonance_inputs);
  const resonance_map = new Map(resonance_scores.map((s) => [s.learning_id, s]));

  // Build domain clusters
  const clusters: DomainCluster[] = [];
  for (const domain of target_domains) {
    const entries = domain_learnings.get(domain.id);
    if (entries == null || entries.length === 0) continue;

    clusters.push({
      domain_id: domain.id,
      domain_name: domain.name,
      target_type: domain.target_type,
      target_path: domain.target_path,
      learnings: entries
        .map(({ learning }) => ({
          id: learning.id,
          title: learning.title,
          category: learning.category,
          feature_id: learning.feature_id,
          resonance: resonance_map.get(learning.id)?.combined ?? 0,
        }))
        .sort((a, b) => b.resonance - a.resonance),
      density: entries.length,
    });
  }

  clusters.sort((a, b) => b.density - a.density);

  // Build cross-domain bridges (learnings in 2+ domains)
  const bridges: KnowledgeBridge[] = [];
  for (const [learning_id, domain_ids] of learning_domains.entries()) {
    if (domain_ids.length < 2) continue;
    const learning = all_learnings.find((l) => l.id === learning_id);
    if (learning == null) continue;
    bridges.push({
      learning_id,
      learning_title: learning.title,
      domains: domain_ids,
    });
  }

  bridges.sort((a, b) => b.domains.length - a.domains.length);

  // Find unmatched tags
  const unmatched_tags: string[] = [];
  if (input.tags.length > 0) {
    const all_keywords = new Set<string>();
    for (const domain of target_domains) {
      for (const k of domain.strong_keywords) all_keywords.add(normalizeTerm(k));
      for (const k of domain.weak_keywords) all_keywords.add(normalizeTerm(k));
    }
    for (const tag of input.tags) {
      if (!all_keywords.has(normalizeTerm(tag))) {
        unmatched_tags.push(tag);
      }
    }
  }

  const total_learnings = seen_ids.size;

  return createTextResult(
    `Explored ${clusters.length} knowledge domain(s) containing ${total_learnings} learning(s).` +
      (bridges.length > 0 ? ` Found ${bridges.length} cross-domain bridge(s).` : '') +
      (unmatched_tags.length > 0 ? ` Unmatched tags: [${unmatched_tags.join(', ')}].` : ''),
    {
      clusters,
      bridges,
      unmatched_tags,
      domain_stats: {
        total_domains: domains.length,
        explored: clusters.length,
        total_learnings,
      },
    }
  );
}
