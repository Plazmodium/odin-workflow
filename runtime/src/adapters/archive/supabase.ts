/**
 * Supabase Archive Adapter
 * Version: 0.1.0
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { RuntimeConfig } from '../../config.js';
import type { ArchiveUploadResult, FeatureArchiveRecord } from '../../types.js';
import type { ArchiveAdapter, RecordArchiveInput, UploadArchiveInput } from './types.js';

type JsonRecord = { [key: string]: unknown };

function requireArchiveConfig(config: RuntimeConfig): {
  url: string;
  secret_key: string;
  invoke_key: string;
} {
  const url = config.supabase?.url;
  const secret_key = config.supabase?.secret_key;
  const invoke_key = config.supabase?.anon_key ?? config.supabase?.publishable_key;

  if (!url || !secret_key || !invoke_key) {
    throw new Error(
      'Supabase archive adapter requires SUPABASE_URL, SUPABASE_SECRET_KEY, and a JWT-capable invoke key (prefer SUPABASE_ANON_KEY).' 
    );
  }

  return { url, secret_key, invoke_key };
}

function toArchiveRecord(row: JsonRecord): FeatureArchiveRecord {
  return {
    id: String(row.id),
    feature_id: String(row.feature_id),
    storage_path: String(row.storage_path),
    summary: String(row.summary),
    files_archived: Array.isArray(row.files_archived)
      ? row.files_archived.map((value) => String(value))
      : [],
    total_size_bytes: Number(row.total_size_bytes ?? 0),
    spec_snapshot: row.spec_snapshot,
    release_version: row.release_version == null ? undefined : String(row.release_version),
    release_notes: row.release_notes == null ? undefined : String(row.release_notes),
    archived_at: String(row.archived_at),
    archived_by: String(row.archived_by),
  };
}

export class SupabaseArchiveAdapter implements ArchiveAdapter {
  private readonly db: SupabaseClient;
  private readonly invokeClient: SupabaseClient;

  constructor(config: RuntimeConfig) {
    const { url, secret_key, invoke_key } = requireArchiveConfig(config);

    this.db = createClient(url, secret_key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    this.invokeClient = createClient(url, invoke_key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async uploadArchive(input: UploadArchiveInput): Promise<ArchiveUploadResult> {
    const { data, error } = await this.invokeClient.functions.invoke('archive-upload', {
      body: {
        feature_id: input.feature_id,
        files: input.files,
      },
    });

    if (error != null || data == null) {
      throw new Error(`Archive upload failed: ${error?.message ?? 'No result returned.'}`);
    }

    return data as ArchiveUploadResult;
  }

  async recordArchive(input: RecordArchiveInput): Promise<FeatureArchiveRecord> {
    const { data, error } = await this.db
      .from('feature_archives')
      .upsert(
        {
          feature_id: input.feature_id,
          storage_path: input.storage_path,
          summary: input.summary,
          files_archived: input.files_archived,
          total_size_bytes: input.total_size_bytes,
          spec_snapshot: input.spec_snapshot,
          release_version: input.release_version ?? null,
          release_notes: input.release_notes ?? null,
          archived_by: input.archived_by,
        },
        { onConflict: 'feature_id' }
      )
      .select('*')
      .single();

    if (error != null || data == null) {
      throw new Error(`Failed to record feature archive: ${error?.message ?? 'No result returned.'}`);
    }

    return toArchiveRecord(data as JsonRecord);
  }

  async listArchives(feature_id: string): Promise<FeatureArchiveRecord[]> {
    const { data, error } = await this.db
      .from('feature_archives')
      .select('*')
      .eq('feature_id', feature_id)
      .order('archived_at', { ascending: false });

    if (error != null || data == null) {
      return [];
    }

    return (data as JsonRecord[]).map(toArchiveRecord);
  }
}
