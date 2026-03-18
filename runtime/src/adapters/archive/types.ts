/**
 * Archive Adapter Types
 * Version: 0.1.0
 */

import type { ArchiveFile, ArchiveUploadResult, FeatureArchiveRecord } from '../../types.js';

export interface UploadArchiveInput {
  feature_id: string;
  files: ArchiveFile[];
}

export interface RecordArchiveInput {
  feature_id: string;
  storage_path: string;
  summary: string;
  files_archived: string[];
  total_size_bytes: number;
  spec_snapshot: unknown;
  release_version?: string;
  release_notes?: string;
  archived_by: string;
}

export interface ArchiveAdapter {
  uploadArchive(input: UploadArchiveInput): Promise<ArchiveUploadResult>;
  recordArchive(input: RecordArchiveInput): Promise<FeatureArchiveRecord>;
  listArchives(feature_id: string): Promise<FeatureArchiveRecord[]>;
}
