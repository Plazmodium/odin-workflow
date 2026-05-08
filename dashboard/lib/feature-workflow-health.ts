import 'server-only';

import { basename, resolve } from 'node:path';

import { FilesystemSkillAdapter } from '../../runtime/src/adapters/skills/filesystem';
import { InMemoryWorkflowStateAdapter } from '../../runtime/src/adapters/workflow-state/in-memory';
import { SupabaseWorkflowStateAdapter } from '../../runtime/src/adapters/workflow-state/supabase';
import type { SkillAdapter } from '../../runtime/src/adapters/skills/types';
import type { WorkflowStateAdapter } from '../../runtime/src/adapters/workflow-state/types';
import { loadRuntimeConfig, type RuntimeConfig } from '../../runtime/src/config';
import type {
  FeatureWorkflowHealth,
  FeatureWorkflowHealthStatus,
} from '../../runtime/src/domain/feature-workflow-health';
import { handleGetFeatureHealth } from '../../runtime/src/tools/get-feature-health';

export type { FeatureWorkflowHealth, FeatureWorkflowHealthStatus };

export interface FeatureWorkflowHealthResult {
  workflow_health: FeatureWorkflowHealth | null;
  error: string | null;
}

interface RuntimeComponents {
  adapter: WorkflowStateAdapter;
  skillAdapter: SkillAdapter;
  config: RuntimeConfig;
}

const WORKFLOW_HEALTH_STATUSES = [
  'ready',
  'running',
  'blocked',
  'waiting_on_review',
  'waiting_on_watchers',
  'waiting_on_human',
  'needs_attention',
  'complete',
] as const satisfies readonly FeatureWorkflowHealthStatus[];
const WORKFLOW_HEALTH_STATUS_SET = new Set<string>(WORKFLOW_HEALTH_STATUSES);

let cachedRuntime: RuntimeComponents | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isWorkflowHealthStatus(value: unknown): value is FeatureWorkflowHealthStatus {
  return typeof value === 'string' && WORKFLOW_HEALTH_STATUS_SET.has(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isFeatureWorkflowHealth(value: unknown): value is FeatureWorkflowHealth {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.feature_id !== 'string' ||
    typeof value.feature_name !== 'string' ||
    !isWorkflowHealthStatus(value.status) ||
    typeof value.summary !== 'string' ||
    !isRecord(value.current_focus) ||
    typeof value.current_focus.phase !== 'string' ||
    typeof value.current_focus.phase_name !== 'string' ||
    !Array.isArray(value.blockers) ||
    !Array.isArray(value.warnings) ||
    !isStringArray(value.next_actions)
  ) {
    return false;
  }

  return true;
}

function getErrorText(error: unknown): string {
  return error instanceof Error ? error.message : 'An unknown runtime feature-health error occurred.';
}

function getResultText(result: Awaited<ReturnType<typeof handleGetFeatureHealth>>): string {
  return result.content.map((item) => item.text).join('\n');
}

function getProjectRoot(): string {
  if (process.env.ODIN_PROJECT_ROOT != null && process.env.ODIN_PROJECT_ROOT.length > 0) {
    return process.env.ODIN_PROJECT_ROOT;
  }

  const cwd = process.cwd();
  return basename(cwd) === 'dashboard' ? resolve(cwd, '..') : cwd;
}

function getRuntimeComponents(): RuntimeComponents {
  if (cachedRuntime != null) {
    return cachedRuntime;
  }

  const projectRoot = getProjectRoot();
  const config = loadRuntimeConfig(projectRoot);
  const adapter = config.runtime.mode === 'supabase'
    ? new SupabaseWorkflowStateAdapter(config)
    : new InMemoryWorkflowStateAdapter();
  cachedRuntime = {
    adapter,
    skillAdapter: new FilesystemSkillAdapter(projectRoot, config),
    config,
  };
  return cachedRuntime;
}

export async function getFeatureWorkflowHealth(featureId: string): Promise<FeatureWorkflowHealthResult> {
  try {
    const runtime = getRuntimeComponents();
    const result = await handleGetFeatureHealth(runtime.adapter, runtime.skillAdapter, runtime.config, {
      feature_id: featureId,
    });

    if (result.isError === true) {
      return { workflow_health: null, error: getResultText(result) };
    }

    if (!isFeatureWorkflowHealth(result.structuredContent)) {
      return {
        workflow_health: null,
        error: 'Odin runtime returned an unexpected feature workflow health payload shape.',
      };
    }

    return { workflow_health: result.structuredContent, error: null };
  } catch (error) {
    return { workflow_health: null, error: getErrorText(error) };
  }
}
