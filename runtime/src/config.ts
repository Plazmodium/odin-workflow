/**
 * Odin Runtime Config Loader
 * Version: 0.1.0
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import dotenv from 'dotenv';
import YAML from 'yaml';

import {
  AUTOMATION_MERGE_STRATEGIES,
  AUTOMATION_MODES,
  type AutomationMergeStrategy,
  type AutomationMode,
  type AutomationPolicyConfig,
} from './types.js';

export interface RuntimeConfig {
  runtime: {
    mode: 'supabase' | 'in_memory';
  };
  skills?: {
    paths?: string[];
    defaults?: string[];
    auto_detect?: boolean;
  };
  database?: {
    url?: string;
  };
  supabase?: {
    url?: string;
    secret_key?: string;
    access_token?: string;
  };
  review?: {
    provider?: 'semgrep';
  };
  formal_verification?: {
    provider?: 'tla-precheck' | 'none';
    timeout_seconds?: number;
  };
  archive?: {
    provider?: 'supabase' | 'none';
  };
  automation?: Partial<AutomationPolicyConfig>;
}

export const CONFIG_RESTART_NOTE =
  'Changes to .env, .env.local, or .odin/config.yaml are only picked up when the Odin MCP server starts. Restart the MCP server after changing runtime config.';

const DEFAULT_CONFIG: RuntimeConfig = {
  runtime: {
    mode: 'supabase',
  },
  skills: {
    paths: ['.odin/skills'],
    defaults: [],
    auto_detect: true,
  },
  review: {
    provider: 'semgrep',
  },
  formal_verification: {
    provider: 'none',
    timeout_seconds: 120,
  },
  archive: {
    provider: 'none',
  },
  automation: {
    mode: 'guarded',
    allowed_base_branches: [],
    require_green_checks: true,
    require_clean_policy_checks: true,
    require_no_open_blockers: true,
    require_watched_claims_verified: true,
    paused: false,
    kill_switch: false,
    merge_strategy: 'squash',
  },
};

export interface RuntimeConfigSummary {
  project_root: string;
  runtime_mode: RuntimeConfig['runtime']['mode'];
  workflow_state_backend: 'supabase' | 'in_memory';
  archive_backend: 'supabase' | 'none';
  review_provider: string;
  skills_auto_detect: boolean;
  automation_mode: AutomationMode;
  automation_paused: boolean;
  automation_kill_switch: boolean;
}

function isAutomationMode(value: unknown): value is AutomationMode {
  return typeof value === 'string' && AUTOMATION_MODES.includes(value as AutomationMode);
}

function isAutomationMergeStrategy(value: unknown): value is AutomationMergeStrategy {
  return typeof value === 'string' && AUTOMATION_MERGE_STRATEGIES.includes(value as AutomationMergeStrategy);
}

function resolveBooleanField(
  value: unknown,
  fallback: boolean,
  field_name: string,
  source: string,
): boolean {
  if (value == null) {
    return fallback;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${field_name} in ${source}. Expected a boolean value.`);
  }

  return value;
}

function normalizeAutomationConfig(
  project_root: string,
  config: RuntimeConfig,
  config_path: string | null,
): RuntimeConfig {
  const default_automation: AutomationPolicyConfig = {
    mode: 'guarded',
    allowed_base_branches: [],
    require_green_checks: true,
    require_clean_policy_checks: true,
    require_no_open_blockers: true,
    require_watched_claims_verified: true,
    paused: false,
    kill_switch: false,
    merge_strategy: 'squash',
  };
  const raw = config.automation ?? {};
  const mode = raw.mode ?? default_automation.mode;
  const source = config_path ?? `${project_root}/.odin/config.yaml`;

  if (!isAutomationMode(mode)) {
    throw new Error(
      `Invalid automation.mode "${String(mode)}" in ${source}. Supported: ${AUTOMATION_MODES.join(', ')}.`
    );
  }

  if (mode === 'auto_merge') {
    throw new Error(
      `automation.mode "auto_merge" is configured in ${source}, but autonomous merge is not supported yet. Use "guarded" or "auto_pr".`
    );
  }

  const merge_strategy = raw.merge_strategy ?? default_automation.merge_strategy;
  if (!isAutomationMergeStrategy(merge_strategy)) {
    throw new Error(
      `Invalid automation.merge_strategy "${String(merge_strategy)}" in ${source}. Supported: ${AUTOMATION_MERGE_STRATEGIES.join(', ')}.`
    );
  }

  if (raw.allowed_base_branches != null && !Array.isArray(raw.allowed_base_branches)) {
    throw new Error(`Invalid automation.allowed_base_branches in ${source}. Expected an array of branch names.`);
  }

  if (Array.isArray(raw.allowed_base_branches) && raw.allowed_base_branches.some((branch) => typeof branch !== 'string')) {
    throw new Error(`Invalid automation.allowed_base_branches in ${source}. Expected only string branch names.`);
  }

  const allowed_base_branches = Array.isArray(raw.allowed_base_branches)
    ? raw.allowed_base_branches
        .map((branch) => branch.trim())
        .filter((branch) => branch.length > 0)
    : default_automation.allowed_base_branches;

  return {
    ...config,
    automation: {
      mode,
      allowed_base_branches,
      require_green_checks: resolveBooleanField(
        raw.require_green_checks,
        default_automation.require_green_checks,
        'automation.require_green_checks',
        source,
      ),
      require_clean_policy_checks: resolveBooleanField(
        raw.require_clean_policy_checks,
        default_automation.require_clean_policy_checks,
        'automation.require_clean_policy_checks',
        source,
      ),
      require_no_open_blockers: resolveBooleanField(
        raw.require_no_open_blockers,
        default_automation.require_no_open_blockers,
        'automation.require_no_open_blockers',
        source,
      ),
      require_watched_claims_verified: resolveBooleanField(
        raw.require_watched_claims_verified,
        default_automation.require_watched_claims_verified,
        'automation.require_watched_claims_verified',
        source,
      ),
      paused: resolveBooleanField(raw.paused, default_automation.paused, 'automation.paused', source),
      kill_switch: resolveBooleanField(
        raw.kill_switch,
        default_automation.kill_switch,
        'automation.kill_switch',
        source,
      ),
      merge_strategy,
    },
  };
}

function loadEnvFiles(project_root: string): void {
  const env_paths = [join(project_root, '.env.local'), join(project_root, '.env')];

  for (const env_path of env_paths) {
    if (existsSync(env_path)) {
      dotenv.config({ path: env_path, override: false });
    }
  }
}

function interpolateEnv(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_match, env_name: string) => {
      return process.env[env_name] ?? '';
    });
  }

  if (Array.isArray(value)) {
    return value.map(interpolateEnv);
  }

  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested_value]) => [key, interpolateEnv(nested_value)])
    );
  }

  return value;
}

function mergeConfig(base: RuntimeConfig, override: Partial<RuntimeConfig>): RuntimeConfig {
  const automation_override =
    override.automation == null
      ? {}
      : (() => {
          if (typeof override.automation !== 'object' || Array.isArray(override.automation)) {
            throw new Error('Invalid automation config. Expected automation to be a mapping/object.');
          }

          return override.automation;
        })();

  return {
    runtime: {
      ...base.runtime,
      ...override.runtime,
    },
    database: {
      ...base.database,
      ...override.database,
    },
    supabase: {
      ...base.supabase,
      ...override.supabase,
    },
    skills: {
      ...base.skills,
      ...override.skills,
    },
    review: {
      ...base.review,
      ...override.review,
    },
    formal_verification: {
      ...base.formal_verification,
      ...override.formal_verification,
    },
    archive: {
      ...base.archive,
      ...override.archive,
    },
    automation: {
      ...base.automation,
      ...automation_override,
    },
  };
}

export function loadRuntimeConfig(project_root: string): RuntimeConfig {
  loadEnvFiles(project_root);

  const env_defaults: Partial<RuntimeConfig> = {
    database: {
      url: process.env.DATABASE_URL,
    },
    supabase: {
      url: process.env.SUPABASE_URL,
      secret_key: process.env.SUPABASE_SECRET_KEY,
      access_token: process.env.SUPABASE_ACCESS_TOKEN,
    },
  };

  const config_path = join(project_root, '.odin', 'config.yaml');
  if (!existsSync(config_path)) {
    return normalizeAutomationConfig(project_root, mergeConfig(DEFAULT_CONFIG, env_defaults), null);
  }

  const raw = readFileSync(config_path, 'utf8');
  const parsed = YAML.parse(raw) as Partial<RuntimeConfig> | null;
  const interpolated = interpolateEnv(parsed ?? {}) as Partial<RuntimeConfig>;

  return normalizeAutomationConfig(project_root, mergeConfig(mergeConfig(DEFAULT_CONFIG, env_defaults), interpolated), config_path);
}

export function summarizeRuntimeConfig(
  project_root: string,
  config: RuntimeConfig,
): RuntimeConfigSummary {
  return {
    project_root,
    runtime_mode: config.runtime.mode,
    workflow_state_backend: config.runtime.mode === 'supabase' ? 'supabase' : 'in_memory',
    archive_backend: config.archive?.provider ?? 'none',
    review_provider: config.review?.provider ?? 'semgrep',
    skills_auto_detect: config.skills?.auto_detect ?? true,
    automation_mode: config.automation?.mode ?? 'guarded',
    automation_paused: config.automation?.paused ?? false,
    automation_kill_switch: config.automation?.kill_switch ?? false,
  };
}
