/**
 * Odin Runtime Config Loader
 * Version: 0.1.0
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import dotenv from 'dotenv';
import YAML from 'yaml';

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
    provider?: 'supabase';
  };
}

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
    provider: 'supabase',
  },
};

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
    return mergeConfig(DEFAULT_CONFIG, env_defaults);
  }

  const raw = readFileSync(config_path, 'utf8');
  const parsed = YAML.parse(raw) as Partial<RuntimeConfig> | null;
  const interpolated = interpolateEnv(parsed ?? {}) as Partial<RuntimeConfig>;

  return mergeConfig(mergeConfig(DEFAULT_CONFIG, env_defaults), interpolated);
}
