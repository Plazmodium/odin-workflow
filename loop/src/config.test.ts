import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('loads subagent command JSON from the environment', () => {
    const config = loadConfig([], {
      ODIN_PROJECT_ROOT: '/tmp/project',
      RALPH_SUBAGENT_COMMAND_JSON: '["node","./child-runner.js"]',
    });

    expect(config.project_root).toBe('/tmp/project');
    expect(config.subagent_command).toEqual(['node', './child-runner.js']);
  });

  it('prefers CLI subagent command JSON over the environment', () => {
    const config = loadConfig(
      ['--subagent-command-json', '["node","./cli-child.js"]'],
      {
        RALPH_SUBAGENT_COMMAND_JSON: '["node","./env-child.js"]',
      },
    );

    expect(config.subagent_command).toEqual(['node', './cli-child.js']);
  });
});
