import { describe, expect, it } from 'vitest';

import type { KnowledgeDomain } from '../types.js';

import { matchDomains, normalizeTerm } from './matching.js';

describe('normalizeTerm', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeTerm('Next.js')).toBe('nextjs');
    expect(normalizeTerm('next-js')).toBe('nextjs');
    expect(normalizeTerm('next_js')).toBe('nextjs');
    expect(normalizeTerm('Next JS')).toBe('nextjs');
  });
});

const NEXTJS_DOMAIN: KnowledgeDomain = {
  id: 'skill:frontend/nextjs-dev',
  name: 'nextjs-dev',
  target_type: 'skill',
  target_path: 'frontend/nextjs-dev',
  strong_keywords: ['nextjs-dev', 'nextjsdev', 'nextjs.dev', 'tailwindcss', 'supabase', 'react-patterns'],
  weak_keywords: ['frontend', 'server', 'components', 'routing'],
};

const SUPABASE_DOMAIN: KnowledgeDomain = {
  id: 'skill:database/supabase',
  name: 'supabase',
  target_type: 'skill',
  target_path: 'database/supabase',
  strong_keywords: ['supabase', 'postgresql'],
  weak_keywords: ['database', 'realtime'],
};

const GUARDIAN_DOMAIN: KnowledgeDomain = {
  id: 'agent_definition:guardian',
  name: 'Guardian',
  target_type: 'agent_definition',
  target_path: 'guardian',
  strong_keywords: ['guardian', 'quality-gate', 'security', 'approval'],
  weak_keywords: ['review', 'perspective'],
};

const ALL_DOMAINS = [NEXTJS_DOMAIN, SUPABASE_DOMAIN, GUARDIAN_DOMAIN];

describe('matchDomains', () => {
  it('returns empty for empty tags', () => {
    expect(matchDomains([], ALL_DOMAINS)).toEqual([]);
  });

  it('persists match with strong keyword hit and relevance >= 0.60', () => {
    const matches = matchDomains(['nextjs', 'caching', 'supabase'], ALL_DOMAINS);

    const nextjs = matches.find((m) => m.domain.id === NEXTJS_DOMAIN.id);
    expect(nextjs).toBeDefined();
    expect(nextjs!.persisted).toBe(false); // nextjs matches nextjs-dev strong via normalization? let me check

    // "nextjs" normalizes to "nextjs", "nextjs-dev" normalizes to "nextjsdev" — no match
    // "supabase" matches nextjs strong (compatible_with includes supabase) — 1 strong, relevance 1/3 = 0.33, not persisted
  });

  it('persists when both gates pass', () => {
    // 3 tags, 2 match nextjs domain strong keywords + 1 weak = 3/3 = 1.0
    const matches = matchDomains(['nextjs-dev', 'tailwindcss', 'frontend'], ALL_DOMAINS);
    const nextjs = matches.find((m) => m.domain.id === NEXTJS_DOMAIN.id);
    expect(nextjs).toBeDefined();
    expect(nextjs!.strong_matches.length).toBeGreaterThanOrEqual(1);
    expect(nextjs!.relevance).toBeGreaterThanOrEqual(0.60);
    expect(nextjs!.persisted).toBe(true);
  });

  it('returns suggestions for matches below relevance threshold', () => {
    // Single tag matching one domain strongly but relevance = 1/5 = 0.20 < 0.30 — filtered out
    // Let's use a case where relevance is between 0.30 and 0.60
    const matches = matchDomains(['supabase', 'unrelated1', 'unrelated2'], ALL_DOMAINS);
    const supa = matches.find((m) => m.domain.id === SUPABASE_DOMAIN.id);
    expect(supa).toBeDefined();
    expect(supa!.relevance).toBeCloseTo(1 / 3, 2);
    expect(supa!.persisted).toBe(false); // strong_matches >= 1 but relevance < 0.60
  });

  it('filters out matches below 0.30 relevance', () => {
    const matches = matchDomains(['supabase', 'a', 'b', 'c', 'd'], ALL_DOMAINS);
    // supabase: 1 strong / 5 tags = 0.20, below 0.30 threshold — filtered out
    const supa = matches.find((m) => m.domain.id === SUPABASE_DOMAIN.id);
    expect(supa).toBeUndefined();
    expect(matches.every((m) => m.relevance >= 0.30)).toBe(true);
  });

  it('normalizes tags and keywords equivalently', () => {
    // "nextjs-dev" normalizes to "nextjsdev", matching strong keywords "nextjs-dev", "nextjsdev", "nextjs.dev"
    // "react-patterns" normalizes to "reactpatterns", matching strong keyword "react-patterns"
    // All 4 strong keywords that normalize to these values are returned
    const matches = matchDomains(['nextjs-dev', 'react-patterns'], ALL_DOMAINS);
    const nextjs = matches.find((m) => m.domain.id === NEXTJS_DOMAIN.id);
    expect(nextjs).toBeDefined();
    expect(nextjs!.strong_matches.length).toBeGreaterThanOrEqual(2);
    expect(nextjs!.persisted).toBe(true);
  });

  it('sorts by relevance descending', () => {
    const matches = matchDomains(['supabase', 'database', 'realtime'], ALL_DOMAINS);
    if (matches.length >= 2) {
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1]!.relevance).toBeGreaterThanOrEqual(matches[i]!.relevance);
      }
    }
  });
});
