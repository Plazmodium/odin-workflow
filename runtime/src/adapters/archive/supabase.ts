/**
 * Supabase Archive Adapter
 * Version: 0.2.0
 *
 * Uploads archive files directly to Supabase Storage using the service_role
 * client. No Edge Function required.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { RuntimeConfig } from '../../config.js';
import type { ArchiveUploadResult, FeatureArchiveRecord } from '../../types.js';
import type { ArchiveAdapter, RecordArchiveInput, UploadArchiveInput } from './types.js';

type JsonRecord = { [key: string]: unknown };

const STORAGE_BUCKET = 'feature-archives';

function requireArchiveConfig(config: RuntimeConfig): {
  url: string;
  secret_key: string;
} {
  const url = config.supabase?.url;
  const secret_key = config.supabase?.secret_key;

  if (!url || !secret_key) {
    throw new Error(
      'Supabase archive adapter requires SUPABASE_URL and SUPABASE_SECRET_KEY.'
    );
  }

  return { url, secret_key };
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

  constructor(config: RuntimeConfig) {
    const { url, secret_key } = requireArchiveConfig(config);

    this.db = createClient(url, secret_key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async uploadArchive(input: UploadArchiveInput): Promise<ArchiveUploadResult> {
    await this.ensureBucket();

    const folder = `${input.feature_id}`;
    const files_uploaded: string[] = [];
    const errors: string[] = [];
    let total_size_bytes = 0;

    for (const file of input.files) {
      const path = `${folder}/${file.name}`;
      const content = new TextEncoder().encode(file.content);
      total_size_bytes += content.byteLength;

      const { error } = await this.db.storage
        .from(STORAGE_BUCKET)
        .upload(path, content, {
          contentType: 'text/markdown',
          upsert: true,
        });

      if (error != null) {
        errors.push(`${file.name}: ${error.message}`);
      } else {
        files_uploaded.push(file.name);
      }
    }

    return {
      success: errors.length === 0,
      storage_path: folder,
      files_uploaded,
      total_size_bytes,
      errors: errors.length > 0 ? errors : undefined,
    };
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

  private async ensureBucket(): Promise<void> {
    const { data } = await this.db.storage.getBucket(STORAGE_BUCKET);
    if (data != null) return;

    const { error } = await this.db.storage.createBucket(STORAGE_BUCKET, {
      public: false,
    });

    if (error != null && !error.message.includes('already exists')) {
      throw new Error(`Failed to create storage bucket "${STORAGE_BUCKET}": ${error.message}`);
    }
  }
}
