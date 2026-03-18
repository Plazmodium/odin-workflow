/**
 * Filesystem Skill Adapter
 * Version: 0.1.0
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

import YAML from 'yaml';

import type { RuntimeConfig } from '../../config.js';
import type { FeatureRecord, KnowledgeDomain, PhaseArtifact, ResolvedSkill } from '../../types.js';
import type { ResolveSkillsInput, ResolveSkillsResult, SkillAdapter } from './types.js';

interface SkillMetadata {
  name: string;
  description?: string;
  category: string;
  depends_on?: string[];
  compatible_with?: string[];
}

interface SkillDefinition {
  metadata: SkillMetadata;
  content: string;
  source: ResolvedSkill['source'];
  file_path: string;
}

const PACKAGE_SKILL_MAP: Record<string, string[]> = {
  '@supabase/supabase-js': ['supabase'],
  prisma: ['prisma-orm'],
  fastify: ['nodejs-fastify'],
  express: ['nodejs-express'],
  next: ['nextjs-dev', 'react-patterns'],
  react: ['react-patterns'],
  tailwindcss: ['tailwindcss'],
  vitest: ['vitest'],
  playwright: ['playwright'],
  jest: ['jest'],
  cypress: ['cypress'],
  '@trpc/server': ['trpc'],
  graphql: ['graphql'],
  '@apollo/server': ['graphql'],
  mongodb: ['mongodb'],
  redis: ['redis'],
};

const FILE_SIGNAL_MAP: Array<{ paths: string[]; skills: string[] }> = [
  { paths: ['next.config.js', 'next.config.mjs', 'next.config.ts'], skills: ['nextjs-dev'] },
  { paths: ['tailwind.config.js', 'tailwind.config.ts', 'postcss.config.js'], skills: ['tailwindcss'] },
  { paths: ['prisma/schema.prisma'], skills: ['prisma-orm'] },
  { paths: ['playwright.config.ts', 'playwright.config.js'], skills: ['playwright'] },
  { paths: ['vitest.config.ts', 'vitest.config.js'], skills: ['vitest'] },
  { paths: ['jest.config.js', 'jest.config.ts'], skills: ['jest'] },
  { paths: ['cypress.config.ts', 'cypress.config.js'], skills: ['cypress'] },
];

async function collectSkillFiles(root: string): Promise<string[]> {
  if (!existsSync(root)) {
    return [];
  }

  const files: string[] = [];

  async function visit(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }
      if (entry.isFile() && entry.name === 'SKILL.md') {
        files.push(absolute);
      }
    }
  }

  await visit(root);
  return files;
}

function parseSkillFrontmatter(raw: string): { metadata: SkillMetadata; content: string } | null {
  if (!raw.startsWith('---\n')) {
    return null;
  }

  const closing = raw.indexOf('\n---\n', 4);
  if (closing === -1) {
    return null;
  }

  const frontmatter = raw.slice(4, closing);
  const content = raw.slice(closing + 5).trim();
  const parsed = YAML.parse(frontmatter) as SkillMetadata | null;

  if (parsed == null || typeof parsed.name !== 'string' || typeof parsed.category !== 'string') {
    return null;
  }

  return {
    metadata: {
      ...parsed,
      depends_on: parsed.depends_on ?? [],
      compatible_with: parsed.compatible_with ?? [],
    },
    content,
  };
}

async function loadSkillDefinitions(
  root: string,
  source: ResolvedSkill['source']
): Promise<Map<string, SkillDefinition>> {
  const files = await collectSkillFiles(root);
  const skills = new Map<string, SkillDefinition>();

  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    const parsed = parseSkillFrontmatter(raw);
    if (parsed == null) {
      continue;
    }

    skills.set(parsed.metadata.name, {
      metadata: parsed.metadata,
      content: parsed.content,
      source,
      file_path: file,
    });
  }

  return skills;
}

async function detectRepoSkills(projectRoot: string): Promise<Set<string>> {
  const detected = new Set<string>();

  const packageJsonPath = join(projectRoot, 'package.json');
  if (existsSync(packageJsonPath)) {
    const raw = await readFile(packageJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const packages = new Set<string>([
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {}),
    ]);

    for (const packageName of packages) {
      const skills = PACKAGE_SKILL_MAP[packageName];
      if (skills != null) {
        for (const skill of skills) {
          detected.add(skill);
        }
      }
    }
  }

  for (const signal of FILE_SIGNAL_MAP) {
    if (signal.paths.some((relativePath) => existsSync(join(projectRoot, relativePath)))) {
      for (const skill of signal.skills) {
        detected.add(skill);
      }
    }
  }

  return detected;
}

function collectArtifactText(feature: FeatureRecord, artifacts: PhaseArtifact[]): string {
  const parts: string[] = [
    feature.name,
    feature.requirements_path ?? '',
    feature.branch_name ?? '',
    feature.base_branch ?? '',
    feature.author ?? '',
  ];

  for (const artifact of artifacts) {
    parts.push(JSON.stringify(artifact.content));
    parts.push(artifact.output_type);
  }

  return parts.join(' ').toLowerCase();
}

function collectMentionedSkills(text: string, available: Map<string, SkillDefinition>): Set<string> {
  const mentioned = new Set<string>();

  for (const [name, skill] of available.entries()) {
    const candidates = [name, skill.metadata.category, ...(skill.metadata.compatible_with ?? [])]
      .map((value) => value.toLowerCase())
      .filter((value, index, values) => value.length > 1 && values.indexOf(value) === index);

    if (candidates.some((candidate) => text.includes(candidate))) {
      mentioned.add(name);
    }
  }

  return mentioned;
}

function resolveWithDependencies(
  requested: Iterable<string>,
  skills: Map<string, SkillDefinition>
): SkillDefinition[] {
  const resolved = new Map<string, SkillDefinition>();
  const visiting = new Set<string>();

  function visit(skillName: string): void {
    if (resolved.has(skillName) || visiting.has(skillName)) {
      return;
    }

    const skill = skills.get(skillName);
    if (skill == null) {
      return;
    }

    visiting.add(skillName);
    for (const dependency of skill.metadata.depends_on ?? []) {
      visit(dependency);
    }
    visiting.delete(skillName);
    resolved.set(skillName, skill);
  }

  for (const skillName of requested) {
    visit(skillName);
  }

  return Array.from(resolved.values()).sort((left, right) => {
    const leftPath = relative(process.cwd(), left.file_path);
    const rightPath = relative(process.cwd(), right.file_path);
    return leftPath.localeCompare(rightPath);
  });
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'must',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
  'my', 'your', 'his', 'her', 'our', 'their', 'what', 'which', 'who', 'when', 'where', 'how',
  'not', 'no', 'nor', 'if', 'then', 'else', 'than', 'too', 'very', 'just', 'about', 'up',
  'out', 'so', 'as', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'only', 'own', 'same', 'also', 'use', 'used', 'using', 'development', 'based',
]);

const STATIC_DOMAINS: KnowledgeDomain[] = [
  {
    id: 'agents_md:',
    name: 'Workflow Rules',
    target_type: 'agents_md',
    target_path: null,
    strong_keywords: ['workflow', 'phase', 'odin', 'spec-first', 'quality-gate'],
    weak_keywords: ['merge', 'branch', 'pr', 'skip-phase', 'agent-rule'],
  },
  {
    id: 'agent_definition:guardian',
    name: 'Guardian',
    target_type: 'agent_definition',
    target_path: 'guardian',
    strong_keywords: ['guardian', 'quality-gate', 'security', 'approval'],
    weak_keywords: ['review', 'perspective'],
  },
  {
    id: 'agent_definition:builder',
    name: 'Builder',
    target_type: 'agent_definition',
    target_path: 'builder',
    strong_keywords: ['builder', 'implementation', 'coding'],
    weak_keywords: ['build', 'construct'],
  },
  {
    id: 'agent_definition:architect',
    name: 'Architect',
    target_type: 'agent_definition',
    target_path: 'architect',
    strong_keywords: ['architect', 'specification', 'spec', 'design'],
    weak_keywords: ['architecture', 'structure'],
  },
  {
    id: 'agent_definition:discovery',
    name: 'Discovery',
    target_type: 'agent_definition',
    target_path: 'discovery',
    strong_keywords: ['discovery', 'requirements', 'elicitation'],
    weak_keywords: ['gather', 'explore'],
  },
  {
    id: 'agent_definition:integrator',
    name: 'Integrator',
    target_type: 'agent_definition',
    target_path: 'integrator',
    strong_keywords: ['integrator', 'integration', 'merge-check'],
    weak_keywords: ['combine', 'verify'],
  },
  {
    id: 'agent_definition:release',
    name: 'Release',
    target_type: 'agent_definition',
    target_path: 'release',
    strong_keywords: ['release', 'deployment', 'archive'],
    weak_keywords: ['ship', 'publish'],
  },
];

function extractDescriptionKeywords(description: string): string[] {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function extractNameAliases(name: string): string[] {
  const aliases = [name];
  const stripped = name.replace(/-/g, '');
  if (stripped !== name) {
    aliases.push(stripped);
  }
  const dotted = name.replace(/-/g, '.');
  if (dotted !== name) {
    aliases.push(dotted);
  }
  return aliases;
}

function skillToDomain(skill: SkillDefinition): KnowledgeDomain {
  const meta = skill.metadata;
  const strong_keywords = [
    ...extractNameAliases(meta.name),
    ...(meta.compatible_with ?? []),
    ...(meta.depends_on ?? []),
  ];

  const weak_keywords = [
    meta.category,
    ...extractDescriptionKeywords(meta.description ?? ''),
  ];

  return {
    id: `skill:${meta.category}/${meta.name}`,
    name: meta.name,
    target_type: 'skill',
    target_path: `${meta.category}/${meta.name}`,
    strong_keywords,
    weak_keywords,
  };
}

export class FilesystemSkillAdapter implements SkillAdapter {
  private merged_cache: Map<string, SkillDefinition> | null = null;
  private domains_cache: KnowledgeDomain[] | null = null;

  constructor(
    private readonly projectRoot: string,
    private readonly config: RuntimeConfig
  ) {}

  private async getMergedSkillDefinitions(): Promise<Map<string, SkillDefinition>> {
    if (this.merged_cache != null) {
      return this.merged_cache;
    }

    const builtInRoot = join(this.projectRoot, 'agents', 'skills');
    const builtInSkills = await loadSkillDefinitions(builtInRoot, 'built_in');

    const projectLocalRoots = (this.config.skills?.paths ?? ['.odin/skills']).map((configuredPath) =>
      join(this.projectRoot, configuredPath)
    );

    const mergedSkills = new Map<string, SkillDefinition>(builtInSkills);

    for (const root of projectLocalRoots) {
      const localSkills = await loadSkillDefinitions(root, 'project_local');
      for (const [name, definition] of localSkills.entries()) {
        mergedSkills.set(name, definition);
      }
    }

    this.merged_cache = mergedSkills;
    return mergedSkills;
  }

  async listKnowledgeDomains(): Promise<KnowledgeDomain[]> {
    if (this.domains_cache != null) {
      return this.domains_cache;
    }

    const skills = await this.getMergedSkillDefinitions();
    const domains: KnowledgeDomain[] = [];

    for (const skill of skills.values()) {
      domains.push(skillToDomain(skill));
    }

    domains.push(...STATIC_DOMAINS);

    this.domains_cache = domains;
    return domains;
  }

  async resolveSkills(input: ResolveSkillsInput): Promise<ResolveSkillsResult> {
    const mergedSkills = await this.getMergedSkillDefinitions();

    const requested = new Set<string>(this.config.skills?.defaults ?? []);

    if (this.config.skills?.auto_detect !== false) {
      const repoDetected = await detectRepoSkills(this.projectRoot);
      for (const skill of repoDetected) {
        requested.add(skill);
      }

      const artifactText = collectArtifactText(input.feature, input.artifacts);
      const mentioned = collectMentionedSkills(artifactText, mergedSkills);
      for (const skill of mentioned) {
        requested.add(skill);
      }
    }

    let resolved = resolveWithDependencies(requested, mergedSkills).map<ResolvedSkill>((skill) => ({
      name: skill.metadata.name,
      category: skill.metadata.category,
      source: skill.source,
      content: skill.content,
    }));

    let fallback_used = false;
    if (resolved.length === 0) {
      const generic = mergedSkills.get('generic-dev');
      if (generic != null) {
        fallback_used = true;
        resolved = [
          {
            name: generic.metadata.name,
            category: generic.metadata.category,
            source: generic.source,
            content: generic.content,
          },
        ];
      }
    }

    return { resolved, fallback_used };
  }
}
