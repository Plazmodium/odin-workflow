import { matchDomains, normalizeTerm } from './matching.js';

import type {
  DomainMatch,
  KnowledgeDomain,
  LearningRecord,
  SkillProposalCandidate,
  SkillProposalStatus,
} from '../types.js';

interface SkillProposalSignal {
  topic_key: string;
  display_name: string;
  raw_tag: string;
}

interface SkillProposalAggregate {
  topic_key: string;
  display_name: string;
  evidence_count: number;
  feature_ids: Set<string>;
  sample_tags: Set<string>;
  latest_learning_at: string;
  recent_examples: SkillProposalCandidate['recent_examples'];
}

function formatDisplayName(tag: string): string {
  return tag
    .trim()
    .split(/[\s/_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

function getPersistedCoveredTags(matches: DomainMatch[]): Set<string> {
  return new Set(
    matches
      .filter((match) => match.persisted)
      .flatMap((match) => [...match.strong_matches, ...match.weak_matches])
      .map((keyword) => normalizeTerm(keyword)),
  );
}

export function collectSkillProposalSignals(tags: string[], matches: DomainMatch[]): SkillProposalSignal[] {
  const covered_tags = getPersistedCoveredTags(matches);
  const unresolved = new Map<string, string>();

  for (const tag of tags) {
    const normalized = normalizeTerm(tag);
    if (normalized.length < 3 || covered_tags.has(normalized)) {
      continue;
    }

    if (!unresolved.has(normalized)) {
      unresolved.set(normalized, tag.trim());
    }
  }

  return Array.from(unresolved.entries()).map(([topic_key, raw_tag]) => ({
    topic_key,
    display_name: formatDisplayName(raw_tag),
    raw_tag,
  }));
}

export function computeSkillProposalStatus(
  evidence_count: number,
  feature_count: number,
): SkillProposalStatus {
  return evidence_count >= 3 && feature_count >= 2 ? 'DRAFT_READY' : 'CANDIDATE';
}

export function buildSkillProposalQueue(
  learnings: LearningRecord[],
  domains: KnowledgeDomain[],
  limit?: number,
): SkillProposalCandidate[] {
  const aggregates = new Map<string, SkillProposalAggregate>();

  for (const learning of learnings) {
    if (learning.tags.length === 0) {
      continue;
    }

    const matches = matchDomains(learning.tags, domains);
    const signals = collectSkillProposalSignals(learning.tags, matches);

    for (const signal of signals) {
      const existing = aggregates.get(signal.topic_key) ?? {
        topic_key: signal.topic_key,
        display_name: signal.display_name,
        evidence_count: 0,
        feature_ids: new Set<string>(),
        sample_tags: new Set<string>(),
        latest_learning_at: learning.created_at,
        recent_examples: [],
      };

      existing.evidence_count += 1;
      existing.feature_ids.add(learning.feature_id);
      existing.sample_tags.add(signal.raw_tag);

      if (learning.created_at > existing.latest_learning_at) {
        existing.latest_learning_at = learning.created_at;
      }

      if (!existing.recent_examples.some((example) => example.learning_id === learning.id)) {
        existing.recent_examples.push({
          learning_id: learning.id,
          title: learning.title,
          feature_id: learning.feature_id,
          created_at: learning.created_at,
        });
        existing.recent_examples.sort((left, right) => right.created_at.localeCompare(left.created_at));
        existing.recent_examples = existing.recent_examples.slice(0, 3);
      }

      aggregates.set(signal.topic_key, existing);
    }
  }

  const queue = Array.from(aggregates.values())
    .map<SkillProposalCandidate>((aggregate) => ({
      topic_key: aggregate.topic_key,
      display_name: aggregate.display_name,
      status: computeSkillProposalStatus(aggregate.evidence_count, aggregate.feature_ids.size),
      evidence_count: aggregate.evidence_count,
      feature_count: aggregate.feature_ids.size,
      sample_tags: Array.from(aggregate.sample_tags.values()).sort((left, right) => left.localeCompare(right)),
      latest_learning_at: aggregate.latest_learning_at,
      recent_examples: aggregate.recent_examples,
    }))
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === 'DRAFT_READY' ? -1 : 1;
      }

      if (left.feature_count !== right.feature_count) {
        return right.feature_count - left.feature_count;
      }

      if (left.evidence_count !== right.evidence_count) {
        return right.evidence_count - left.evidence_count;
      }

      const recency = right.latest_learning_at.localeCompare(left.latest_learning_at);
      if (recency !== 0) {
        return recency;
      }

      return left.topic_key.localeCompare(right.topic_key);
    });

  return limit == null ? queue : queue.slice(0, limit);
}
