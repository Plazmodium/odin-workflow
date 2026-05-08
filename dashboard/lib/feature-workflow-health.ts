import 'server-only';

export type FeatureWorkflowHealthStatus =
  | 'ready'
  | 'running'
  | 'blocked'
  | 'waiting_on_review'
  | 'waiting_on_watchers'
  | 'waiting_on_human'
  | 'needs_attention'
  | 'complete';

export type FeatureWorkflowHealthBlockerKind =
  | 'blocker'
  | 'gate'
  | 'finding'
  | 'claim'
  | 'attestation'
  | 'artifact'
  | 'eval'
  | 'release';

export interface FeatureWorkflowHealthIssue {
  kind: FeatureWorkflowHealthBlockerKind;
  message: string;
  recovery: string | null;
}

export interface FeatureWorkflowHealthWarning {
  kind: string;
  message: string;
}

export interface FeatureWorkflowHealth {
  feature_id: string;
  feature_name: string;
  status: FeatureWorkflowHealthStatus;
  summary: string;
  current_focus: {
    phase: string;
    phase_name: string;
  };
  blockers: FeatureWorkflowHealthIssue[];
  warnings: FeatureWorkflowHealthWarning[];
  next_actions: string[];
}

export interface FeatureWorkflowHealthResult {
  workflow_health: FeatureWorkflowHealth | null;
  error: string | null;
}

const WORKFLOW_HEALTH_STATUS_COVERAGE = {
  ready: true,
  running: true,
  blocked: true,
  waiting_on_review: true,
  waiting_on_watchers: true,
  waiting_on_human: true,
  needs_attention: true,
  complete: true,
} as const satisfies Record<FeatureWorkflowHealthStatus, true>;
const WORKFLOW_HEALTH_STATUSES = Object.keys(WORKFLOW_HEALTH_STATUS_COVERAGE) as FeatureWorkflowHealthStatus[];
const WORKFLOW_HEALTH_STATUS_SET = new Set<string>(WORKFLOW_HEALTH_STATUSES);
const WORKFLOW_HEALTH_ENDPOINT = process.env.ODIN_FEATURE_HEALTH_URL;

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
  return error instanceof Error ? error.message : 'An unknown feature workflow health error occurred.';
}

function extractWorkflowHealth(payload: unknown): FeatureWorkflowHealth | null {
  if (isFeatureWorkflowHealth(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return null;
  }

  if (isFeatureWorkflowHealth(payload.structuredContent)) {
    return payload.structuredContent;
  }

  return null;
}

export async function getFeatureWorkflowHealth(featureId: string): Promise<FeatureWorkflowHealthResult> {
  if (WORKFLOW_HEALTH_ENDPOINT == null || WORKFLOW_HEALTH_ENDPOINT.length === 0) {
    return {
      workflow_health: null,
      error: 'Feature workflow health endpoint is not configured. Set ODIN_FEATURE_HEALTH_URL to an HTTP endpoint that returns the odin.get_feature_health payload.',
    };
  }

  try {
    const response = await fetch(WORKFLOW_HEALTH_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ feature_id: featureId }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        workflow_health: null,
        error: `Feature workflow health endpoint returned HTTP ${response.status}.`,
      };
    }

    const payload = await response.json() as unknown;
    const workflow_health = extractWorkflowHealth(payload);
    if (workflow_health == null) {
      return {
        workflow_health: null,
        error: 'Feature workflow health endpoint returned an unexpected payload shape.',
      };
    }

    return { workflow_health, error: null };
  } catch (error) {
    return { workflow_health: null, error: getErrorText(error) };
  }
}
