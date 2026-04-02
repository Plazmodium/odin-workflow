import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import type {
  ArchiveFeatureReleaseInput,
  PickNextAutonomousPhaseResult,
  PickNextAutonomousPhaseOptions,
  PhaseId,
  RecordPhaseResultInput,
  RecordPullRequestInput,
  RecordReleaseCloseoutFailureInput,
  RecordReleaseHandoffFailureInput,
  RecordReleaseHandoffInput,
  RecordSupervisorEventInput,
  RuntimeToolClient,
  SkippedSummaryItem,
} from './types.js';

interface RuntimeClientOptions {
  project_root: string;
  cwd?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asPhaseId(value: unknown): PhaseId | null {
  return typeof value === 'string' ? value : null;
}

function asReleaseNotes(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function asSkippedSummary(value: unknown): SkippedSummaryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const feature_id = asString(item.feature_id);
    const feature_name = asString(item.feature_name);
    const current_phase = asPhaseId(item.current_phase);
    const status = asString(item.status);
    const detail = asString(item.detail);

    if (feature_id == null || feature_name == null || current_phase == null || status == null || detail == null) {
      return [];
    }

    return [{ feature_id, feature_name, current_phase, status, detail }];
  });
}

async function resolveRuntimeServerPath(cwd: string): Promise<string> {
  const candidates = [
    resolve(cwd, '../runtime/dist/server.js'),
    resolve(cwd, '../mcp-servers/odin-runtime/dist/server.js'),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // continue searching
    }
  }

  throw new Error('Could not locate a built Odin runtime server. Build the runtime package first.');
}

function extractStructuredContent(result: Record<string, unknown>): Record<string, unknown> {
  const structured = result.structuredContent;
  if (!isRecord(structured)) {
    throw new Error('Runtime tool did not return structured content.');
  }

  return structured;
}

function extractError(result: Record<string, unknown>): string | null {
  if (result.isError !== true) {
    return null;
  }

  const content = result.content;
  if (!Array.isArray(content)) {
    return 'Runtime tool returned an unknown error.';
  }

  for (const item of content) {
    if (isRecord(item)) {
      const text = asString(item.text);
      if (text != null) {
        return text;
      }
    }
  }

  return 'Runtime tool returned an unknown error.';
}

class McpRuntimeToolClient implements RuntimeToolClient {
  constructor(
    private readonly client: Client,
    private readonly transport: StdioClientTransport,
  ) {}

  async pickNextAutonomousPhase(
    supervisor_name: string,
    options?: PickNextAutonomousPhaseOptions,
  ): Promise<PickNextAutonomousPhaseResult> {
    const result = await this.client.callTool({
      name: 'odin.pick_next_autonomous_phase',
      arguments: {
        supervisor_name,
        agent_name: supervisor_name,
        ...(options?.allowed_selection_reasons == null ? {} : { allowed_selection_reasons: options.allowed_selection_reasons }),
        ...(options?.allowed_phases == null ? {} : { allowed_phases: options.allowed_phases }),
      },
    });

    const error = extractError(result);
    if (error != null) {
      throw new Error(error);
    }

    const structured = extractStructuredContent(result);
    const selection_value = structured.selection;
    const skipped_summary = asSkippedSummary(structured.skipped_summary);
    const context = isRecord(structured.context) ? structured.context : null;

    if (selection_value == null) {
      return {
        selection: null,
        skipped_summary,
      };
    }

    if (!isRecord(selection_value)) {
      throw new Error('Autonomous selection payload was malformed.');
    }

    const feature_id = asString(selection_value.feature_id);
    const feature_name = asString(selection_value.feature_name);
    const phase = asPhaseId(selection_value.phase);
    const reason = asString(selection_value.reason);
    const context_feature = context != null && isRecord(context.feature) ? context.feature : null;
    const context_artifacts = context != null && isRecord(context.artifacts) ? context.artifacts : null;
    const branch_name = context_feature == null ? null : asString(context_feature.branch_name);
    const base_branch = context_feature == null ? null : asString(context_feature.base_branch);
    const release_notes_artifact =
      context_artifacts != null && isRecord(context_artifacts.release_notes) ? context_artifacts.release_notes : null;
    const release_notes =
      release_notes_artifact == null ? null : asReleaseNotes(release_notes_artifact.content);

    if (feature_id == null || feature_name == null || phase == null) {
      throw new Error('Autonomous selection payload was incomplete.');
    }

    return {
      selection: {
        feature_id,
        feature_name,
        phase,
        reason,
        branch_name,
        base_branch,
        release_notes,
      },
      skipped_summary,
    };
  }

  async recordSupervisorEvent(input: RecordSupervisorEventInput): Promise<void> {
    const args: Record<string, unknown> = {
      supervisor_name: input.supervisor_name,
      event_type: input.event_type,
      summary: input.summary,
      feature_id: input.feature_id ?? null,
      ...(input.phase == null ? {} : { phase: input.phase }),
      ...(input.details == null ? {} : { details: input.details }),
    };
    const result = await this.client.callTool({
      name: 'odin.record_supervisor_event',
      arguments: args,
    });
    const error = extractError(result);
    if (error != null) {
      throw new Error(error);
    }
  }

  async recordPhaseResult(input: RecordPhaseResultInput): Promise<void> {
    const args: Record<string, unknown> = {
      feature_id: input.feature_id,
      phase: input.phase,
      outcome: input.outcome,
      next_phase: input.next_phase,
      summary: input.summary,
      created_by: input.created_by,
      blockers: input.blockers,
    };
    const result = await this.client.callTool({
      name: 'odin.record_phase_result',
      arguments: args,
    });
    const error = extractError(result);
    if (error != null) {
      throw new Error(error);
    }
  }

  async archiveFeatureRelease(input: ArchiveFeatureReleaseInput): Promise<void> {
    const args: Record<string, unknown> = {
      feature_id: input.feature_id,
      summary: input.summary,
      archived_by: input.archived_by,
      ...(input.release_notes == null ? {} : { release_notes: input.release_notes }),
    };
    const result = await this.client.callTool({
      name: 'odin.archive_feature_release',
      arguments: args,
    });
    const error = extractError(result);
    if (error != null) {
      throw new Error(error);
    }
  }

  async recordPullRequest(input: RecordPullRequestInput): Promise<void> {
    const result = await this.client.callTool({
      name: 'odin.record_pr',
      arguments: {
        feature_id: input.feature_id,
        pr_url: input.pr_url,
        pr_number: input.pr_number,
      },
    });
    const error = extractError(result);
    if (error != null) {
      throw new Error(error);
    }
  }

  async recordReleaseHandoff(input: RecordReleaseHandoffInput): Promise<void> {
    const result = await this.client.callTool({
      name: 'odin.record_release_handoff',
      arguments: {
        feature_id: input.feature_id,
        summary: input.summary,
        created_by: input.created_by,
      },
    });
    const error = extractError(result);
    if (error != null) {
      throw new Error(error);
    }
  }

  async recordReleaseHandoffFailure(input: RecordReleaseHandoffFailureInput): Promise<void> {
    const result = await this.client.callTool({
      name: 'odin.record_release_handoff_failure',
      arguments: {
        feature_id: input.feature_id,
        summary: input.summary,
        created_by: input.created_by,
      },
    });
    const error = extractError(result);
    if (error != null) {
      throw new Error(error);
    }
  }

  async recordReleaseCloseoutFailure(input: RecordReleaseCloseoutFailureInput): Promise<void> {
    const result = await this.client.callTool({
      name: 'odin.record_release_closeout_failure',
      arguments: {
        feature_id: input.feature_id,
        summary: input.summary,
        created_by: input.created_by,
      },
    });
    const error = extractError(result);
    if (error != null) {
      throw new Error(error);
    }
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}

export async function connectRuntimeClient(options: RuntimeClientOptions): Promise<RuntimeToolClient> {
  const cwd = options.cwd ?? process.cwd();
  const runtime_server_path = await resolveRuntimeServerPath(cwd);
  const transport = new StdioClientTransport({
    command: 'node',
    args: [runtime_server_path],
    cwd,
    env: {
      ...process.env,
      ODIN_PROJECT_ROOT: options.project_root,
    },
  });
  const client = new Client({
    name: 'ralph-loop',
    version: '0.1.0',
  });
  await client.connect(transport);
  return new McpRuntimeToolClient(client, transport);
}
