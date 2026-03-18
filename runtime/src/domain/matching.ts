/**
 * Domain Matching
 * Version: 0.1.0
 */

import type { DomainMatch, KnowledgeDomain } from '../types.js';

export function normalizeTerm(term: string): string {
  return term.toLowerCase().replace(/[.\-_\s]/g, '');
}

export function matchDomains(tags: string[], domains: KnowledgeDomain[]): DomainMatch[] {
  if (tags.length === 0) {
    return [];
  }

  const normalized_tags = new Set(tags.map(normalizeTerm));

  return domains
    .map((domain) => {
      const strong = domain.strong_keywords.filter((k) => normalized_tags.has(normalizeTerm(k)));
      const weak = domain.weak_keywords.filter((k) => normalized_tags.has(normalizeTerm(k)));
      const relevance = (strong.length + weak.length) / Math.max(1, normalized_tags.size);
      const persisted = strong.length >= 1 && relevance >= 0.60;
      return { domain, relevance, strong_matches: strong, weak_matches: weak, persisted };
    })
    .filter((m) => m.relevance >= 0.30)
    .sort((a, b) => b.relevance - a.relevance);
}
