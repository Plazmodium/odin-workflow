/**
 * Data layer: Archive queries
 */
import { createServerClient } from '@/lib/supabase';
import type { FeatureArchive } from '@/lib/types/database';

/**
 * Get archive metadata for a feature.
 * Returns null if no archive exists.
 */
export async function getFeatureArchive(
  featureId: string
): Promise<FeatureArchive | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('feature_archives')
    .select(
      'id, feature_id, storage_path, summary, files_archived, total_size_bytes, release_version, release_notes, archived_at, archived_by'
    )
    .eq('feature_id', featureId)
    .maybeSingle();

  if (error || !data) return null;
  return data as FeatureArchive;
}
