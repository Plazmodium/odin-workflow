import { mkdir, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { ExportLocalArtifactsInput } from '../schemas.js';
import type { FeatureRecord, PhaseArtifact } from '../types.js';
import { createErrorResult, createTextResult } from '../utils.js';

function isWithinProjectRoot(project_root: string, candidate: string): boolean {
  const relative_path = relative(project_root, candidate);
  return relative_path === '' || (!relative_path.startsWith('..') && !relative_path.startsWith(`..${sep}`));
}

function renderValue(value: unknown): string {
  if (value == null) {
    return '_None_';
  }

  if (typeof value === 'string') {
    return value.trim().length === 0 ? '_None_' : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function renderArtifact(title: string, artifact: PhaseArtifact | null): string {
  if (artifact == null) {
    return `# ${title}\n\n_No ${title.toLowerCase()} artifact has been recorded._\n`;
  }

  return [
    `# ${title}`,
    '',
    `- Artifact ID: ${artifact.id}`,
    `- Phase: ${artifact.phase}`,
    `- Created by: ${artifact.created_by}`,
    `- Created at: ${artifact.created_at}`,
    artifact.artifact_path == null ? null : `- Source path: ${artifact.artifact_path}`,
    '',
    renderValue(artifact.content),
    '',
  ].filter((line): line is string => line != null).join('\n');
}

function renderReleaseHandoff(feature: FeatureRecord): string {
  return [
    '# Release Handoff',
    '',
    `- Feature: ${feature.id}`,
    `- PR URL: ${feature.pr_url ?? 'not recorded'}`,
    `- PR number: ${feature.pr_number ?? 'not recorded'}`,
    `- Handoff created at: ${feature.release_handoff_at ?? 'not recorded'}`,
    `- Handoff created by: ${feature.release_handoff_by ?? 'not recorded'}`,
    '',
    feature.release_handoff_summary ?? '_No release handoff summary has been recorded._',
    '',
  ].join('\n');
}

function renderReleaseCloseout(feature: FeatureRecord): string {
  return [
    '# Release Closeout',
    '',
    `- Feature: ${feature.id}`,
    `- Merged at: ${feature.merged_at ?? 'not recorded'}`,
    `- Closeout created at: ${feature.release_closeout_at ?? 'not recorded'}`,
    `- Closeout created by: ${feature.release_closeout_by ?? 'not recorded'}`,
    `- Completed at: ${feature.completed_at ?? 'not recorded'}`,
    '',
    feature.release_closeout_summary ?? '_No release closeout summary has been recorded._',
    '',
  ].join('\n');
}

function latestArtifact(artifacts: PhaseArtifact[], output_type: string): PhaseArtifact | null {
  return artifacts.filter((artifact) => artifact.output_type === output_type).at(-1) ?? null;
}

export async function handleExportLocalArtifacts(
  adapter: WorkflowStateAdapter,
  project_root: string,
  input: ExportLocalArtifactsInput,
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, { feature_id: input.feature_id });
  }

  const output_dir = resolve(project_root, input.output_dir ?? `.odin/exports/${input.feature_id}`);
  if (!isWithinProjectRoot(project_root, output_dir)) {
    return createErrorResult('output_dir must resolve inside the Odin project root.', {
      feature_id: input.feature_id,
      project_root,
      output_dir,
    });
  }

  const artifacts = await adapter.listPhaseArtifacts(input.feature_id);
  const files = input.include.map((kind) => {
    switch (kind) {
      case 'prd':
        return { name: 'prd.md', content: renderArtifact('PRD', latestArtifact(artifacts, 'prd')) };
      case 'eval_plan':
        return { name: 'eval-plan.md', content: renderArtifact('Eval Plan', latestArtifact(artifacts, 'eval_plan')) };
      case 'eval_run':
        return { name: 'eval-run.md', content: renderArtifact('Eval Run', latestArtifact(artifacts, 'eval_run')) };
      case 'release_handoff':
        return { name: 'release-handoff.md', content: renderReleaseHandoff(feature) };
      case 'release_closeout':
        return { name: 'release-closeout.md', content: renderReleaseCloseout(feature) };
    }
  });

  await mkdir(output_dir, { recursive: true });
  const written_files: string[] = [];
  for (const file of files) {
    const file_path = resolve(output_dir, file.name);
    if (!isWithinProjectRoot(project_root, file_path)) {
      return createErrorResult(`Refusing to write outside project root: ${file_path}`, {
        feature_id: input.feature_id,
        file_path,
      });
    }
    await writeFile(file_path, file.content, 'utf8');
    written_files.push(relative(project_root, file_path));
  }

  await adapter.recordAuditEvent(input.feature_id, 'LOCAL_ARTIFACTS_EXPORTED', 'odin-runtime', {
    output_dir: relative(project_root, output_dir),
    written_files,
  });

  return createTextResult(`Exported ${written_files.length} local artifact file(s) for feature ${input.feature_id}.`, {
    feature_id: input.feature_id,
    output_dir: relative(project_root, output_dir),
    written_files,
  });
}
