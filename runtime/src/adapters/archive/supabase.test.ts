import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RuntimeConfig } from '../../config.js';
import { SupabaseArchiveAdapter } from './supabase.js';

const mocks = vi.hoisted(() => {
  const getBucket = vi.fn();
  const createBucket = vi.fn();
  const storageFrom = vi.fn();
  const upload = vi.fn();
  const tableFrom = vi.fn();
  const upsert = vi.fn();
  const select = vi.fn();
  const single = vi.fn();
  const createClient = vi.fn();

  return {
    getBucket,
    createBucket,
    storageFrom,
    upload,
    tableFrom,
    upsert,
    select,
    single,
    createClient,
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

function createConfig(): RuntimeConfig {
  return {
    runtime: { mode: 'supabase' },
    supabase: {
      url: 'https://example.supabase.co',
      secret_key: 'secret-key',
    },
  };
}

describe('SupabaseArchiveAdapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.storageFrom.mockReturnValue({
      upload: mocks.upload,
    });

    mocks.upsert.mockReturnValue({
      select: mocks.select,
    });

    mocks.select.mockReturnValue({
      single: mocks.single,
    });

    mocks.tableFrom.mockReturnValue({
      upsert: mocks.upsert,
    });

    mocks.createClient.mockReturnValue({
      storage: {
        getBucket: mocks.getBucket,
        createBucket: mocks.createBucket,
        from: mocks.storageFrom,
      },
      from: mocks.tableFrom,
    });
  });

  it('uploads archive markdown files into the private feature-archives bucket', async () => {
    mocks.getBucket.mockResolvedValue({ data: null });
    mocks.createBucket.mockResolvedValue({ error: null });
    mocks.upload.mockResolvedValue({ error: null });

    const adapter = new SupabaseArchiveAdapter(createConfig());
    const result = await adapter.uploadArchive({
      feature_id: 'FEAT-ARCHIVE',
      files: [{ name: 'spec.md', content: '# Spec\n' }],
    });

    expect(mocks.getBucket).toHaveBeenCalledWith('feature-archives');
    expect(mocks.createBucket).toHaveBeenCalledWith('feature-archives', { public: false });
    expect(mocks.storageFrom).toHaveBeenCalledWith('feature-archives');
    expect(mocks.upload).toHaveBeenCalledWith(
      'FEAT-ARCHIVE/spec.md',
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'text/markdown', upsert: true })
    );
    expect(result).toMatchObject({
      success: true,
      storage_path: 'FEAT-ARCHIVE',
      files_uploaded: ['spec.md'],
    });
  });

  it('records the archive row after storage upload', async () => {
    mocks.single.mockResolvedValue({
      error: null,
      data: {
        id: 'archive_1',
        feature_id: 'FEAT-ARCHIVE',
        storage_path: 'FEAT-ARCHIVE',
        summary: 'Archive summary',
        files_archived: ['spec.md'],
        total_size_bytes: 42,
        spec_snapshot: { scope: 'test' },
        archived_at: '2026-03-20T16:00:00.000Z',
        archived_by: 'release-agent',
      },
    });

    const adapter = new SupabaseArchiveAdapter(createConfig());
    const archive = await adapter.recordArchive({
      feature_id: 'FEAT-ARCHIVE',
      storage_path: 'FEAT-ARCHIVE',
      summary: 'Archive summary',
      files_archived: ['spec.md'],
      total_size_bytes: 42,
      spec_snapshot: { scope: 'test' },
      archived_by: 'release-agent',
    });

    expect(mocks.tableFrom).toHaveBeenCalledWith('feature_archives');
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_id: 'FEAT-ARCHIVE',
        storage_path: 'FEAT-ARCHIVE',
        archived_by: 'release-agent',
      }),
      { onConflict: 'feature_id' }
    );
    expect(archive).toMatchObject({
      feature_id: 'FEAT-ARCHIVE',
      storage_path: 'FEAT-ARCHIVE',
      files_archived: ['spec.md'],
    });
  });
});
