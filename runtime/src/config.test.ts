import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { loadRuntimeConfig } from './config.js';

function createTmpDir(): string {
  const dir = join(tmpdir(), `odin-config-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('loadRuntimeConfig automation defaults', () => {
  const created_dirs: string[] = [];

  afterEach(() => {
    for (const dir of created_dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('defaults missing automation config to guarded mode', () => {
    const dir = createTmpDir();
    created_dirs.push(dir);

    const config = loadRuntimeConfig(dir);
    expect(config.automation).toEqual({
      mode: 'guarded',
      allowed_base_branches: [],
      require_green_checks: true,
      require_clean_policy_checks: true,
      require_no_open_blockers: true,
      require_watched_claims_verified: true,
      paused: false,
      kill_switch: false,
      merge_strategy: 'squash',
    });
    expect(config.attestation).toEqual({
      mode: 'advisory',
      require_execution_phases: ['5', '6', '7', '9'],
      require_prompt_realization_phases: ['5', '6', '7', '9'],
    });
  });

  it('loads strict attestation config and rejects invalid phase ids', () => {
    const dir = createTmpDir();
    created_dirs.push(dir);
    const odin_dir = join(dir, '.odin');
    mkdirSync(odin_dir, { recursive: true });

    writeFileSync(
      join(odin_dir, 'config.yaml'),
      [
        'runtime:',
        '  mode: in_memory',
        'attestation:',
        '  mode: strict',
        '  require_execution_phases: ["5", "9"]',
        '  require_prompt_realization_phases: ["5"]',
      ].join('\n'),
      'utf8'
    );

    const config = loadRuntimeConfig(dir);
    expect(config.attestation).toEqual({
      mode: 'strict',
      require_execution_phases: ['5', '9'],
      require_prompt_realization_phases: ['5'],
    });

    writeFileSync(
      join(odin_dir, 'config.yaml'),
      [
        'runtime:',
        '  mode: in_memory',
        'attestation:',
        '  mode: strict',
        '  require_execution_phases: ["11"]',
      ].join('\n'),
      'utf8'
    );

    expect(() => loadRuntimeConfig(dir)).toThrow('attestation.require_execution_phases');
  });

  it('rejects unsupported auto_merge mode explicitly', () => {
    const dir = createTmpDir();
    created_dirs.push(dir);
    const odin_dir = join(dir, '.odin');
    mkdirSync(odin_dir, { recursive: true });
    writeFileSync(
      join(odin_dir, 'config.yaml'),
      ['runtime:', '  mode: in_memory', 'automation:', '  mode: auto_merge'].join('\n'),
      'utf8'
    );

    expect(() => loadRuntimeConfig(dir)).toThrow('autonomous merge is not supported yet');
  });

  it('trims allowlisted base branches and rejects invalid boolean fields', () => {
    const dir = createTmpDir();
    created_dirs.push(dir);
    const odin_dir = join(dir, '.odin');
    mkdirSync(odin_dir, { recursive: true });

    writeFileSync(
      join(odin_dir, 'config.yaml'),
      [
        'runtime:',
        '  mode: in_memory',
        'automation:',
        '  mode: auto_pr',
        '  allowed_base_branches:',
        '    - " main "',
        '  paused: "false"',
      ].join('\n'),
      'utf8'
    );

    expect(() => loadRuntimeConfig(dir)).toThrow('automation.paused');

    writeFileSync(
      join(odin_dir, 'config.yaml'),
      [
        'runtime:',
        '  mode: in_memory',
        'automation:',
        '  mode: auto_pr',
        '  allowed_base_branches: main',
      ].join('\n'),
      'utf8'
    );

    expect(() => loadRuntimeConfig(dir)).toThrow('automation.allowed_base_branches');

    writeFileSync(
      join(odin_dir, 'config.yaml'),
      [
        'runtime:',
        '  mode: in_memory',
        'automation: auto_pr',
      ].join('\n'),
      'utf8'
    );

    expect(() => loadRuntimeConfig(dir)).toThrow('Invalid automation config');

    writeFileSync(
      join(odin_dir, 'config.yaml'),
      [
        'runtime:',
        '  mode: in_memory',
        'automation:',
        '  mode: auto_pr',
        '  allowed_base_branches:',
        '    - " main "',
        '  paused: false',
      ].join('\n'),
      'utf8'
    );

    const config = loadRuntimeConfig(dir);
    expect(config.automation?.allowed_base_branches).toEqual(['main']);
  });
});
