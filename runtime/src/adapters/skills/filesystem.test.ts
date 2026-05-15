import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '../../config.js';
import type { FeatureRecord } from '../../types.js';
import { FilesystemSkillAdapter } from './filesystem.js';

function createFeature(): FeatureRecord {
  return {
    id: 'FEAT-SKILL',
    name: 'Skill Test',
    status: 'IN_PROGRESS',
    current_phase: '5',
    complexity_level: 1,
    severity: 'ROUTINE',
    author: 'Jane Doe',
    created_at: '2026-03-20T00:00:00.000Z',
    updated_at: '2026-03-20T00:00:00.000Z',
  };
}

const createdDirs: string[] = [];

function createProjectRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'odin-runtime-skill-'));
  createdDirs.push(root);
  mkdirSync(join(root, '.odin', 'skills'), { recursive: true });
  return root;
}

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('FilesystemSkillAdapter.resolveSkills', () => {
  it('loads packaged built-in skills for Builder in an external project', async () => {
    const projectRoot = createProjectRoot();
    const adapter = new FilesystemSkillAdapter(projectRoot, {
      runtime: { mode: 'in_memory' },
      skills: { paths: ['.odin/skills'], defaults: [], auto_detect: true },
    } satisfies RuntimeConfig);

    const result = await adapter.resolveSkills({
      feature: createFeature(),
      artifacts: [],
      phase: '5',
    });

    expect(result.resolved.map((skill) => skill.name)).toContain('unit-tests-sdd');
  });

  it('combines mandatory Builder testing skill with detected framework skill', async () => {
    const projectRoot = createProjectRoot();
    writeFileSync(
      join(projectRoot, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^3.2.4' } }, null, 2),
      'utf8'
    );

    const adapter = new FilesystemSkillAdapter(projectRoot, {
      runtime: { mode: 'in_memory' },
      skills: { paths: ['.odin/skills'], defaults: [], auto_detect: true },
    } satisfies RuntimeConfig);

    const result = await adapter.resolveSkills({
      feature: createFeature(),
      artifacts: [],
      phase: '5',
    });

    expect(result.resolved.map((skill) => skill.name)).toEqual(
      expect.arrayContaining(['unit-tests-sdd', 'vitest', 'using-agent-skills', 'incremental-implementation', 'test-driven-development'])
    );
  });

  it('loads Reviewer test evaluation skill', async () => {
    const projectRoot = createProjectRoot();
    const adapter = new FilesystemSkillAdapter(projectRoot, {
      runtime: { mode: 'in_memory' },
      skills: { paths: ['.odin/skills'], defaults: [], auto_detect: true },
    } satisfies RuntimeConfig);

    const result = await adapter.resolveSkills({
      feature: createFeature(),
      artifacts: [],
      phase: '6',
    });

    expect(result.resolved.map((skill) => skill.name)).toEqual(
      expect.arrayContaining(['unit-tests-eval-sdd', 'using-agent-skills', 'code-review-and-quality', 'security-and-hardening'])
    );
  });

  it('does not treat broad category words like api/architecture/testing as matches for every skill in those categories', async () => {
    const projectRoot = createProjectRoot();
    const adapter = new FilesystemSkillAdapter(projectRoot, {
      runtime: { mode: 'in_memory' },
      skills: { paths: ['.odin/skills'], defaults: [], auto_detect: true },
    } satisfies RuntimeConfig);

    const result = await adapter.resolveSkills({
      feature: createFeature(),
      artifacts: [
        {
          id: 'artifact_1',
          feature_id: 'FEAT-SKILL',
          phase: '3',
          output_type: 'spec',
          content: {
            summary: 'Build a GraphQL API endpoint with testing and architecture review.',
          },
          created_by: 'architect-agent',
          created_at: '2026-03-24T00:00:00.000Z',
        },
      ],
      phase: '5',
    });

    expect(result.resolved.map((skill) => skill.name)).toEqual(
      expect.arrayContaining(['graphql', 'unit-tests-sdd'])
    );
    expect(result.resolved.map((skill) => skill.name)).not.toEqual(
      expect.arrayContaining(['grpc', 'rest-api', 'trpc', 'clean-architecture', 'domain-driven-design'])
    );
  });

  it('loads release workflow skills for Release instead of loading the whole repo tech stack', async () => {
    const projectRoot = createProjectRoot();
    writeFileSync(
      join(projectRoot, 'package.json'),
      JSON.stringify(
        {
          dependencies: {
            next: '^14.2.35',
            react: '^18.3.0',
            '@supabase/supabase-js': '^2.49.1',
          },
          devDependencies: {
            vitest: '^3.2.4',
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const adapter = new FilesystemSkillAdapter(projectRoot, {
      runtime: { mode: 'in_memory' },
      skills: { paths: ['.odin/skills'], defaults: [], auto_detect: true },
    } satisfies RuntimeConfig);

    const result = await adapter.resolveSkills({
      feature: createFeature(),
      artifacts: [],
      phase: '9',
    });

    expect(result.resolved.map((skill) => `${skill.category}/${skill.name}`)).toEqual(
      expect.arrayContaining([
        'workflow/using-agent-skills',
        'workflow/shipping-and-launch',
        'workflow/git-workflow-and-versioning',
        'workflow/ci-cd-and-automation',
        'workflow/documentation-and-adrs',
      ])
    );
    expect(result.resolved.map((skill) => skill.name)).not.toEqual(
      expect.arrayContaining(['nextjs-dev', 'react-patterns', 'supabase', 'vitest'])
    );
    expect(result.fallback_used).toBe(false);
  });

  it('adds generic-dev when a tech-aware phase only resolves workflow skills', async () => {
    const projectRoot = createProjectRoot();
    const adapter = new FilesystemSkillAdapter(projectRoot, {
      runtime: { mode: 'in_memory' },
      skills: { paths: ['.odin/skills'], defaults: [], auto_detect: true },
    } satisfies RuntimeConfig);

    const result = await adapter.resolveSkills({
      feature: createFeature(),
      artifacts: [],
      phase: '2',
    });

    expect(result.resolved.map((skill) => `${skill.category}/${skill.name}`)).toEqual(
      expect.arrayContaining([
        'workflow/using-agent-skills',
        'workflow/context-engineering',
        'workflow/spec-driven-development',
        'foundation/generic-dev',
      ])
    );
    expect(result.fallback_used).toBe(true);
  });

  it('loads topical workflow skills from artifact language', async () => {
    const projectRoot = createProjectRoot();
    const adapter = new FilesystemSkillAdapter(projectRoot, {
      runtime: { mode: 'in_memory' },
      skills: { paths: ['.odin/skills'], defaults: [], auto_detect: true },
    } satisfies RuntimeConfig);

    const result = await adapter.resolveSkills({
      feature: createFeature(),
      artifacts: [
        {
          id: 'artifact_api',
          feature_id: 'FEAT-SKILL',
          phase: '2',
          output_type: 'requirements',
          content: {
            summary: 'Design a stable API endpoint with auth, rollback, and latency targets.',
          },
          created_by: 'discovery-agent',
          created_at: '2026-03-24T00:00:00.000Z',
        },
      ],
      phase: '3',
    });

    expect(result.resolved.map((skill) => `${skill.category}/${skill.name}`)).toEqual(
      expect.arrayContaining([
        'workflow/api-and-interface-design',
        'workflow/security-and-hardening',
        'workflow/shipping-and-launch',
        'workflow/performance-optimization',
      ])
    );
  });
});
