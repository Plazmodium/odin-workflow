/**
 * Resonance Scoring Tests
 */

import { describe, expect, it } from 'vitest';

import { computeResonance, type ResonanceInput } from './resonance.js';

function makeInput(overrides: Partial<ResonanceInput> & { id: string }): ResonanceInput {
  return {
    category: 'PATTERN',
    confidence_score: 0.8,
    source_feature_id: 'FEAT-001',
    shared_domains: [],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('computeResonance', () => {
  it('returns empty array for empty input', () => {
    expect(computeResonance([])).toEqual([]);
  });

  it('returns scores sorted by combined descending', () => {
    const now = new Date('2026-03-18T00:00:00Z');
    const learnings: ResonanceInput[] = [
      makeInput({ id: 'L1', shared_domains: ['skill:supabase'], created_at: '2026-03-17T00:00:00Z', source_feature_id: 'F1' }),
      makeInput({ id: 'L2', shared_domains: ['skill:supabase'], created_at: '2026-03-18T00:00:00Z', source_feature_id: 'F2' }),
    ];

    const scores = computeResonance(learnings, now);
    expect(scores).toHaveLength(2);
    // L2 is more recent, so it should score higher on recency
    expect(scores[0].learning_id).toBe('L2');
  });

  it('gives higher density score when many learnings share a domain', () => {
    const now = new Date('2026-03-18T00:00:00Z');
    const base_date = '2026-03-18T00:00:00Z';
    const learnings: ResonanceInput[] = [
      makeInput({ id: 'L1', shared_domains: ['skill:supabase'], created_at: base_date, source_feature_id: 'F1' }),
      makeInput({ id: 'L2', shared_domains: ['skill:supabase'], created_at: base_date, source_feature_id: 'F2' }),
      makeInput({ id: 'L3', shared_domains: ['skill:supabase'], created_at: base_date, source_feature_id: 'F3' }),
      makeInput({ id: 'lonely', shared_domains: ['skill:redis'], created_at: base_date, source_feature_id: 'F4' }),
    ];

    const scores = computeResonance(learnings, now);
    const supabase_scores = scores.filter((s) => s.learning_id !== 'lonely');
    const lonely_score = scores.find((s) => s.learning_id === 'lonely')!;

    // All supabase learnings should have higher density than the lone redis one
    for (const s of supabase_scores) {
      expect(s.density).toBeGreaterThan(lonely_score.density);
    }
  });

  it('gives higher corroboration when different features agree', () => {
    const now = new Date('2026-03-18T00:00:00Z');
    const base_date = '2026-03-18T00:00:00Z';
    const learnings: ResonanceInput[] = [
      makeInput({ id: 'L1', shared_domains: ['skill:supabase'], category: 'GOTCHA', created_at: base_date, source_feature_id: 'F1' }),
      makeInput({ id: 'L2', shared_domains: ['skill:supabase'], category: 'GOTCHA', created_at: base_date, source_feature_id: 'F2' }),
      makeInput({ id: 'L3', shared_domains: ['skill:supabase'], category: 'GOTCHA', created_at: base_date, source_feature_id: 'F3' }),
      makeInput({ id: 'alone', shared_domains: ['skill:supabase'], category: 'DECISION', created_at: base_date, source_feature_id: 'F4' }),
    ];

    const scores = computeResonance(learnings, now);
    const gotcha_scores = scores.filter((s) => s.learning_id !== 'alone');
    const alone_score = scores.find((s) => s.learning_id === 'alone')!;

    for (const s of gotcha_scores) {
      expect(s.corroboration).toBeGreaterThan(alone_score.corroboration);
    }
  });

  it('applies recency decay — older learnings score lower', () => {
    const now = new Date('2026-03-18T00:00:00Z');
    const learnings: ResonanceInput[] = [
      makeInput({ id: 'recent', shared_domains: ['skill:supabase'], created_at: '2026-03-17T00:00:00Z', source_feature_id: 'F1' }),
      makeInput({ id: 'old', shared_domains: ['skill:supabase'], created_at: '2026-01-01T00:00:00Z', source_feature_id: 'F2' }),
    ];

    const scores = computeResonance(learnings, now);
    const recent = scores.find((s) => s.learning_id === 'recent')!;
    const old = scores.find((s) => s.learning_id === 'old')!;

    expect(recent.recency).toBeGreaterThan(old.recency);
  });

  it('does not count same-feature learnings for corroboration', () => {
    const now = new Date('2026-03-18T00:00:00Z');
    const base_date = '2026-03-18T00:00:00Z';
    const learnings: ResonanceInput[] = [
      makeInput({ id: 'L1', shared_domains: ['skill:supabase'], category: 'GOTCHA', created_at: base_date, source_feature_id: 'F1' }),
      makeInput({ id: 'L2', shared_domains: ['skill:supabase'], category: 'GOTCHA', created_at: base_date, source_feature_id: 'F1' }),
    ];

    const scores = computeResonance(learnings, now);
    // Both from same feature — corroboration should be 0
    expect(scores[0].corroboration).toBe(0);
    expect(scores[1].corroboration).toBe(0);
  });

  it('rounds scores to 3 decimal places', () => {
    const now = new Date('2026-03-18T00:00:00Z');
    const learnings: ResonanceInput[] = [
      makeInput({ id: 'L1', shared_domains: ['skill:supabase'], created_at: '2026-03-15T00:00:00Z', source_feature_id: 'F1' }),
    ];

    const scores = computeResonance(learnings, now);
    const s = scores[0];
    // Check that values are rounded
    expect(String(s.density).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
    expect(String(s.recency).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
    expect(String(s.combined).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
  });
});
