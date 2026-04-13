import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import type {
  ArchiveFeatureReleaseInput,
  PickNextAutonomousPhaseResult,
  PickNextAutonomousPhaseOptions,
  PhaseChildStateStrategy,
  PhaseExecutionMode,
  PhaseId,
  PhasePromptSection,
  PreparedPhaseContext,
  RecordPhaseArtifactInput,
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

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value.flatMap((entry) => (typeof entry === 'string' ? [entry] : []));
  return parsed.length === value.length ? parsed : null;
}

function asExecutionMode(value: unknown): PhaseExecutionMode | null {
  return value === 'inline' || value === 'subagent' ? value : null;
}

function parseExecutionModeArray(value: unknown): PhaseExecutionMode[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value.flatMap((entry) => {
    const mode = asExecutionMode(entry);
    return mode == null ? [] : [mode];
  });
  return parsed.length === value.length ? parsed : null;
}

function asChildStateStrategy(value: unknown): PhaseChildStateStrategy | null {
  return value === 'direct_odin_tools_if_available' || value === 'return_intent_to_parent'
    ? value
    : null;
}

function parsePromptSectionArray(value: unknown): PhasePromptSection[] | null {
  const allowed = new Set<PhasePromptSection>([
    'phase',
    'role_summary',
    'constraints',
    'development_evals',
    'automation',
    'verification',
    'workflow',
    'artifacts',
    'skills',
    'learnings',
  ]);

  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value.flatMap((entry) => (typeof entry === 'string' && allowed.has(entry as PhasePromptSection)
    ? [entry as PhasePromptSection]
    : []));
  return parsed.length === value.length ? parsed : null;
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

function extractPreparedContext(context: Record<string, unknown> | null): PreparedPhaseContext {
  if (context == null) {
    throw new Error('Autonomous selection did not include a prepared phase context.');
  }

  const phase = isRecord(context.phase) ? context.phase : null;
  const agent = isRecord(context.agent) ? context.agent : null;
  const execution = isRecord(context.execution) ? context.execution : null;

  const phase_id = phase == null ? null : asPhaseId(phase.id);
  const phase_name = phase == null ? null : asString(phase.name);
  const phase_purpose = phase == null ? null : asString(phase.purpose);
  const definition_of_done = phase == null ? null : parseStringArray(phase.definition_of_done);
  const agent_name = agent == null ? null : asString(agent.name);
  const role_summary = agent == null ? null : asString(agent.role_summary);
  const constraints = agent == null ? null : parseStringArray(agent.constraints);
  const phase_role_name = execution == null ? null : asString(execution.phase_role_name);
  const acting_agent_name = execution == null ? null : asString(execution.acting_agent_name);
  const supported_modes = execution == null ? null : parseExecutionModeArray(execution.supported_modes);
  const recommended_mode = execution == null ? null : asExecutionMode(execution.recommended_mode);
  const child_state_strategy = execution == null ? null : asChildStateStrategy(execution.child_state_strategy);
  const prompt_sections = execution == null ? null : parsePromptSectionArray(execution.prompt_sections);

  if (
    phase_id == null ||
    phase_name == null ||
    agent_name == null ||
    role_summary == null ||
    definition_of_done == null ||
    constraints == null ||
    phase_role_name == null ||
    acting_agent_name == null ||
    supported_modes == null ||
    recommended_mode == null ||
    child_state_strategy == null ||
    prompt_sections == null ||
    supported_modes.length === 0
  ) {
    throw new Error('Prepared phase context was incomplete for autonomous execution.');
  }

  if (!supported_modes.includes(recommended_mode)) {
    throw new Error('Prepared phase context had an invalid execution contract.');
  }

  return {
    raw: context,
    phase: {
      id: phase_id,
      name: phase_name,
      purpose: phase_purpose,
      definition_of_done,
    },
    agent: {
      name: agent_name,
      role_summary,
      constraints,
    },
    execution: {
      phase_role_name,
      acting_agent_name,
      supported_modes,
      recommended_mode,
      child_state_strategy,
      prompt_sections,
    },
  };
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
    const prepared_context = extractPreparedContext(context);

    if (feature_id == null || feature_name == null || phase == null) {
      throw new Error('Autonomous selection payload was incomplete.');
    }

    if (prepared_context.phase.id !== phase) {
      throw new Error('Autonomous selection phase did not match the prepared phase context.');
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
        prepared_context,
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

  async recordPhaseArtifact(input: RecordPhaseArtifactInput): Promise<void> {
    const result = await this.client.callTool({
      name: 'odin.record_phase_artifact',
      arguments: {
        feature_id: input.feature_id,
        phase: input.phase,
        output_type: input.output_type,
        content: input.content,
        created_by: input.created_by,
      },
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
      summary: input.summary,
      created_by: input.created_by,
      blockers: input.blockers,
    };
    if (input.next_phase != null) {
      args.next_phase = input.next_phase;
    }
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
    version: '0.2.0',
  });
  await client.connect(transport);
  return new McpRuntimeToolClient(client, transport);
}
