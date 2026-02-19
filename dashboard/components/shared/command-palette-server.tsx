/**
 * CommandPaletteServer
 *
 * Server component wrapper that fetches data for the CommandPalette client component.
 * Placed in the root layout so it's available on every page.
 * 
 * Gracefully handles missing Supabase config during build by returning empty data.
 */

import { getAllFeaturesSummary, getRecentLearnings } from '@/lib/data/health';
import { isSupabaseConfigured } from '@/lib/supabase';
import { CommandPalette } from './command-palette';

export async function CommandPaletteServer() {
  // During build, Supabase might not be configured yet - return empty palette
  if (!isSupabaseConfigured()) {
    return <CommandPalette features={[]} learnings={[]} />;
  }

  const [features, learnings] = await Promise.all([
    getAllFeaturesSummary(),
    getRecentLearnings(20),
  ]);

  const featureItems = features.map((f) => ({
    feature_id: f.feature_id,
    feature_name: f.feature_name,
    feature_status: f.feature_status,
    current_phase: f.current_phase,
  }));

  const learningItems = learnings.map((l) => ({
    id: l.id,
    title: l.title,
    category: l.category,
  }));

  return <CommandPalette features={featureItems} learnings={learningItems} />;
}
