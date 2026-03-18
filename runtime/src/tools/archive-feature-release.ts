/**
 * Archive Feature Release Tool
 * Version: 0.1.0
 */

import type { ArchiveAdapter } from '../adapters/archive/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { ArchiveFeatureReleaseInput } from '../schemas.js';
import type { ArchiveFile, PhaseArtifact } from '../types.js';
import { createErrorResult, createTextResult } from '../utils.js';

function titleize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatScalar(value: unknown): string {
  if (value == null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function tryParseJson(value: string): unknown | null {
  const trimmed = value.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

function renderMarkdown(value: unknown, depth = 2): string {
  if (value == null) {
    return '_No content provided._';
  }

  if (typeof value === 'string') {
    if (value.trim().length === 0) return '_No content provided._';
    const parsed = tryParseJson(value);
    if (parsed != null) return renderMarkdown(parsed, depth);
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '_None_';
    }

    return value
      .map((item, index) => {
        if (item != null && typeof item === 'object' && !Array.isArray(item)) {
          const object = item as Record<string, unknown>;
          const keys = Object.keys(object);
          const isMultiField = keys.length > 1;
          const prefix = isMultiField ? `**${index + 1}.** ` : '';
          const lines = Object.entries(object).map(([key, nested]) => {
            if (nested != null && typeof nested === 'object') {
              const nestedBody = renderMarkdown(nested, depth + 1)
                .split('\n')
                .map((line) => `  ${line}`)
                .join('\n');
              return `- **${titleize(key)}**:\n${nestedBody}`;
            }
            return `- **${titleize(key)}**: ${formatScalar(nested)}`;
          });
          return (prefix ? `${prefix}\n` : '') + lines.join('\n');
        }

        return `- ${formatScalar(item)}`;
      })
      .join('\n\n');
  }

  const object = value as Record<string, unknown>;
  const sections = Object.entries(object).map(([key, nested]) => {
    const heading = `${'#'.repeat(Math.min(depth, 6))} ${titleize(key)}`;
    return `${heading}\n\n${renderMarkdown(nested, depth + 1)}`;
  });

  return sections.join('\n\n');
}

function artifactToArchiveFile(artifact: PhaseArtifact): ArchiveFile {
  const title = titleize(artifact.output_type);
  const body = renderMarkdown(artifact.content);

  return {
    name: `${artifact.output_type}.md`,
    content: `# ${title}\n\n${body}\n`,
  };
}

const DEFAULT_ARCHIVE_OUTPUT_TYPES = [
  'prd',
  'requirements',
  'spec',
  'tasks',
  'review',
  'documentation',
  'release_notes',
];

function selectArtifacts(artifacts: PhaseArtifact[], include_output_types: string[]): PhaseArtifact[] {
  const selected = new Map<string, PhaseArtifact>();

  for (const output_type of include_output_types) {
    const matching = artifacts.filter((artifact) => artifact.output_type === output_type);
    const latest = matching.at(-1);
    if (latest != null) {
      selected.set(output_type, latest);
    }
  }

  return Array.from(selected.values());
}

export async function autoArchiveFeature(
  workflow_state: WorkflowStateAdapter,
  archive_adapter: ArchiveAdapter,
  feature_id: string,
  summary: string,
  archived_by: string
): Promise<{ files_archived: number; storage_path: string } | null> {
  const artifacts = await workflow_state.listPhaseArtifacts(feature_id);
  const selected = selectArtifacts(artifacts, DEFAULT_ARCHIVE_OUTPUT_TYPES);

  if (selected.length === 0) {
    return null;
  }

  const files = selected.map(artifactToArchiveFile);
  const upload = await archive_adapter.uploadArchive({ feature_id, files });

  if (upload.success !== true) {
    return null;
  }

  const spec_snapshot = selected.find((artifact) => artifact.output_type === 'spec')?.content ?? {};

  await archive_adapter.recordArchive({
    feature_id,
    storage_path: upload.storage_path,
    summary,
    files_archived: upload.files_uploaded,
    total_size_bytes: upload.total_size_bytes,
    spec_snapshot,
    archived_by,
  });

  return { files_archived: upload.files_uploaded.length, storage_path: upload.storage_path };
}

export async function handleArchiveFeatureRelease(
  workflow_state: WorkflowStateAdapter,
  archive_adapter: ArchiveAdapter | null,
  input: ArchiveFeatureReleaseInput
) {
  if (archive_adapter == null) {
    return createErrorResult(
      'Archive adapter is unavailable. Configure Supabase archival before using this tool.',
      { feature_id: input.feature_id }
    );
  }

  const feature = await workflow_state.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const artifacts = await workflow_state.listPhaseArtifacts(input.feature_id);
  const selected = selectArtifacts(artifacts, input.include_output_types);

  if (selected.length === 0) {
    return createErrorResult(
      `No matching phase artifacts were found for feature ${input.feature_id}.`,
      {
        feature_id: input.feature_id,
        include_output_types: input.include_output_types,
      }
    );
  }

  const files = selected.map(artifactToArchiveFile);
  const upload = await archive_adapter.uploadArchive({
    feature_id: input.feature_id,
    files,
  });

  if (upload.success !== true) {
    return createErrorResult(
      `Archive upload failed for feature ${input.feature_id}.`,
      {
        feature_id: input.feature_id,
        upload_errors: upload.errors ?? [],
      }
    );
  }

  const spec_snapshot = selected.find((artifact) => artifact.output_type === 'spec')?.content ?? {};

  const archive_record = await archive_adapter.recordArchive({
    feature_id: input.feature_id,
    storage_path: upload.storage_path,
    summary: input.summary,
    files_archived: upload.files_uploaded,
    total_size_bytes: upload.total_size_bytes,
    spec_snapshot,
    release_version: input.release_version,
    release_notes: input.release_notes,
    archived_by: input.archived_by,
  });

  return createTextResult(
    `Archived ${upload.files_uploaded.length} file(s) for feature ${input.feature_id}.`,
    {
      feature,
      archive: archive_record,
      uploaded_files: upload.files_uploaded,
      upload_errors: upload.errors ?? [],
    }
  );
}
