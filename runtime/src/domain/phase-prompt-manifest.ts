import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PhaseArtifact, PhaseContextBundle, PhaseId, PhasePromptManifest, ResolvedSkill } from '../types.js';

const MANIFEST_VERSION = '1';
let cachedDefinitionsRoot: string | null = null;
const staticHashCache = new Map<PhaseId, { shared_context_hash: string; phase_definition_hash: string }>();

const PHASE_DEFINITION_FILES: Partial<Record<PhaseId, string>> = {
  '0': 'planning.md',
  '1': 'product.md',
  '2': 'discovery.md',
  '3': 'architect.md',
  '4': 'guardian.md',
  '5': 'builder.md',
  '6': 'reviewer.md',
  '7': 'integrator.md',
  '8': 'documenter.md',
  '9': 'release.md',
};

type PromptProjection = {
  phase: PhaseContextBundle['phase'];
  agent: {
    name: string;
    role_summary: string;
    constraints: string[];
  };
  sections: Partial<Record<
    PhaseContextBundle['execution']['prompt_sections'][number],
    unknown
  >>;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value != null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

type PhasePromptManifestSeed = Omit<PhasePromptManifest, 'manifest_id' | 'nonce'>;

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

export function computePhasePromptManifestId(seed: PhasePromptManifestSeed): string {
  return hashValue({
    phase: seed.phase,
    phase_role_name: seed.phase_role_name,
    shared_context_hash: seed.shared_context_hash,
    phase_definition_hash: seed.phase_definition_hash,
    resolved_skill_hashes: seed.resolved_skill_hashes,
    required_prompt_sections: seed.required_prompt_sections,
    context_bundle_hash: seed.context_bundle_hash,
    manifest_version: seed.manifest_version,
  });
}

function resolveAgentDefinitionsRoot(): string {
  if (cachedDefinitionsRoot != null) {
    return cachedDefinitionsRoot;
  }

  const current_file = fileURLToPath(import.meta.url);
  const package_root = resolve(dirname(current_file), '..', '..', '..');
  let cursor = package_root;

  for (let depth = 0; depth < 6; depth++) {
    const candidate = join(cursor, 'agents', 'definitions');
    const shared_context = join(candidate, '_shared-context.md');
    const builder = join(candidate, 'builder.md');

    if (existsSync(shared_context) && existsSync(builder)) {
      cachedDefinitionsRoot = candidate;
      return candidate;
    }

    const parent = resolve(cursor, '..');
    if (parent === cursor) {
      break;
    }

    cursor = parent;
  }

  throw new Error('Could not resolve Odin agents/definitions directory for phase prompt manifest generation.');
}

function buildArtifactProjection(artifacts: Partial<Record<PhaseArtifact['output_type'], PhaseArtifact>>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(artifacts)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([output_type, artifact]) => [
        output_type,
        artifact == null
          ? null
          : {
              id: artifact.id,
              phase: artifact.phase,
              output_type: artifact.output_type,
              content: artifact.content,
              created_by: artifact.created_by,
              created_at: artifact.created_at,
            },
      ])
  );
}

function buildPromptProjection(bundle: PhaseContextBundle): PromptProjection {
  const sections: PromptProjection['sections'] = {};

  for (const section of bundle.execution.prompt_sections) {
    switch (section) {
      case 'phase':
        sections.phase = bundle.phase;
        break;
      case 'role_summary':
        sections.role_summary = bundle.agent.role_summary;
        break;
      case 'constraints':
        sections.constraints = bundle.agent.constraints;
        break;
      case 'development_evals':
        sections.development_evals = bundle.development_evals;
        break;
      case 'automation':
        sections.automation = bundle.automation;
        break;
      case 'verification':
        sections.verification = bundle.verification;
        break;
      case 'workflow':
        sections.workflow = bundle.workflow;
        break;
      case 'artifacts':
        sections.artifacts = buildArtifactProjection(bundle.artifacts);
        break;
      case 'skills':
        sections.skills = bundle.skills.resolved.map((skill) => ({
          name: skill.name,
          category: skill.category,
          source: skill.source,
          content: skill.content,
        }));
        break;
      case 'learnings':
        sections.learnings = bundle.learnings;
        break;
    }
  }

  return {
    phase: bundle.phase,
    agent: {
      name: bundle.agent.name,
      role_summary: bundle.agent.role_summary,
      constraints: bundle.agent.constraints,
    },
    sections,
  };
}

function buildSkillHashes(skills: ResolvedSkill[]): string[] {
  return skills
    .map((skill) => ({
      ...skill,
      hash: hashValue({
        name: skill.name,
        category: skill.category,
        source: skill.source,
        content: skill.content,
      }),
    }))
    .sort((left, right) => compareStrings(left.name, right.name))
    .map((skill) => skill.hash);
}

export async function buildPhasePromptManifest(bundle: PhaseContextBundle): Promise<PhasePromptManifest | null> {
  const phase_definition_file = PHASE_DEFINITION_FILES[bundle.phase.id];
  if (phase_definition_file == null) {
    return null;
  }

  const { shared_context_hash, phase_definition_hash } = await computeStaticPhasePromptHashes(bundle.phase.id);
  const resolved_skill_hashes = buildSkillHashes(bundle.skills.resolved);
  const context_bundle_hash = hashValue(buildPromptProjection(bundle));
  const nonce = randomUUID();

  const manifest_payload = {
    phase: bundle.phase.id,
    phase_role_name: bundle.execution.phase_role_name,
    shared_context_hash,
    phase_definition_hash,
    resolved_skill_hashes,
    required_prompt_sections: bundle.execution.prompt_sections,
    context_bundle_hash,
    manifest_version: MANIFEST_VERSION,
    nonce,
  };

  return {
    manifest_id: computePhasePromptManifestId(manifest_payload),
    phase: bundle.phase.id,
    phase_role_name: bundle.execution.phase_role_name,
    shared_context_hash,
    phase_definition_hash,
    resolved_skill_hashes,
    required_prompt_sections: [...bundle.execution.prompt_sections],
    context_bundle_hash,
    manifest_version: MANIFEST_VERSION,
    nonce,
  };
}

export async function computeStaticPhasePromptHashes(phase: PhaseId): Promise<{
  shared_context_hash: string;
  phase_definition_hash: string;
}> {
  const cached = staticHashCache.get(phase);
  if (cached != null) {
    return cached;
  }

  const phase_definition_file = PHASE_DEFINITION_FILES[phase];
  if (phase_definition_file == null) {
    throw new Error(`Phase ${phase} does not have a phase definition file for prompt manifest generation.`);
  }

  const definitions_root = resolveAgentDefinitionsRoot();
  const [shared_context_raw, phase_definition_raw] = await Promise.all([
    readFile(join(definitions_root, '_shared-context.md'), 'utf8'),
    readFile(join(definitions_root, phase_definition_file), 'utf8'),
  ]);

  const hashes = {
    shared_context_hash: hashValue(normalizeText(shared_context_raw)),
    phase_definition_hash: hashValue(normalizeText(phase_definition_raw)),
  };

  staticHashCache.set(phase, hashes);
  return hashes;
}
