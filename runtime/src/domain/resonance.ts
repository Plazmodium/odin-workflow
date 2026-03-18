/**
 * Resonance Scoring
 * Version: 0.1.0
 *
 * Retrieval-time ranking signal for related learnings.
 * Resonance is computed in-memory and NEVER written to confidence_score.
 */

export interface ResonanceInput {
  id: string;
  category: string;
  confidence_score: number;
  source_feature_id: string;
  shared_domains: string[];
  created_at: string;
}

export interface ResonanceScore {
  learning_id: string;
  density: number;
  corroboration: number;
  recency: number;
  combined: number;
}

/**
 * Compute domain density — how many learnings share each domain.
 * Returns a map of domain key → count of learnings in that domain.
 */
function computeDomainDensity(learnings: ResonanceInput[]): Map<string, number> {
  const density = new Map<string, number>();
  for (const learning of learnings) {
    for (const domain of learning.shared_domains) {
      density.set(domain, (density.get(domain) ?? 0) + 1);
    }
  }
  return density;
}

/**
 * Density score: average density across this learning's shared domains,
 * normalized to 0–1 using log scaling (caps at density 20+).
 */
function scoreDensity(learning: ResonanceInput, density_map: Map<string, number>): number {
  if (learning.shared_domains.length === 0) {
    return 0;
  }

  let total = 0;
  for (const domain of learning.shared_domains) {
    total += density_map.get(domain) ?? 0;
  }

  const avg = total / learning.shared_domains.length;
  return Math.min(1, Math.log2(avg + 1) / Math.log2(21));
}

/**
 * Corroboration score: how many other learnings from DIFFERENT features
 * share at least one domain AND the same category.
 * Normalized to 0–1 (caps at 5 corroborating learnings).
 */
function scoreCorroboration(learning: ResonanceInput, all_learnings: ResonanceInput[]): number {
  const domain_set = new Set(learning.shared_domains);
  let count = 0;

  for (const other of all_learnings) {
    if (other.id === learning.id) continue;
    if (other.source_feature_id === learning.source_feature_id) continue;
    if (other.category !== learning.category) continue;

    const overlaps = other.shared_domains.some((d) => domain_set.has(d));
    if (overlaps) {
      count++;
    }
  }

  return Math.min(1, count / 5);
}

/**
 * Recency score: exponential decay based on age in days.
 * Half-life of 30 days — a learning 30 days old scores 0.5.
 */
function scoreRecency(learning: ResonanceInput, now: Date): number {
  const created = new Date(learning.created_at);
  const age_ms = now.getTime() - created.getTime();
  const age_days = Math.max(0, age_ms / (1000 * 60 * 60 * 24));
  const half_life = 30;
  return Math.pow(0.5, age_days / half_life);
}

/**
 * Compute resonance scores for a set of related learnings.
 * Returns scores sorted by combined resonance (descending).
 *
 * Weights: density 0.3, corroboration 0.4, recency 0.3
 * These are tuned for knowledge retrieval — corroboration (agreement
 * from different features) is weighted highest as it's the strongest
 * signal that a learning is broadly applicable.
 */
export function computeResonance(
  learnings: ResonanceInput[],
  now?: Date
): ResonanceScore[] {
  if (learnings.length === 0) {
    return [];
  }

  const reference = now ?? new Date();
  const density_map = computeDomainDensity(learnings);

  return learnings
    .map((learning) => {
      const density = scoreDensity(learning, density_map);
      const corroboration = scoreCorroboration(learning, learnings);
      const recency = scoreRecency(learning, reference);
      const combined = 0.3 * density + 0.4 * corroboration + 0.3 * recency;

      return {
        learning_id: learning.id,
        density: Math.round(density * 1000) / 1000,
        corroboration: Math.round(corroboration * 1000) / 1000,
        recency: Math.round(recency * 1000) / 1000,
        combined: Math.round(combined * 1000) / 1000,
      };
    })
    .sort((a, b) => b.combined - a.combined);
}
