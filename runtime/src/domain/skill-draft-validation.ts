import YAML from 'yaml';

import type { KnowledgeDomain, SkillProposalRecord } from '../types.js';

export interface SkillDraftMetadata {
  name: string;
  description?: string;
  category: string;
  depends_on: string[];
  compatible_with: string[];
}

export interface SkillDraftValidationResult {
  valid: boolean;
  metadata: SkillDraftMetadata | null;
  errors: string[];
  warnings: string[];
  generated_path: string | null;
}

function parseFrontmatter(markdown: string): { metadata: SkillDraftMetadata | null; content: string } {
  if (!markdown.startsWith('---\n')) {
    return { metadata: null, content: markdown.trim() };
  }

  const closing = markdown.indexOf('\n---\n', 4);
  if (closing === -1) {
    return { metadata: null, content: markdown.trim() };
  }

  const frontmatter = markdown.slice(4, closing);
  const content = markdown.slice(closing + 5).trim();
  const parsed = YAML.parse(frontmatter) as Record<string, unknown> | null;

  if (parsed == null || typeof parsed !== 'object') {
    return { metadata: null, content };
  }

  return {
    metadata: {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      description: typeof parsed.description === 'string' ? parsed.description : undefined,
      category: typeof parsed.category === 'string' ? parsed.category : '',
      depends_on: Array.isArray(parsed.depends_on) ? parsed.depends_on.map((value) => String(value)) : [],
      compatible_with: Array.isArray(parsed.compatible_with)
        ? parsed.compatible_with.map((value) => String(value))
        : [],
    },
    content,
  };
}

function slugSegment(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function getGeneratedSkillPath(category: string, skill_name: string): string {
  return `.odin/skills/generated/${slugSegment(category)}/${slugSegment(skill_name)}/SKILL.md`;
}

export function validateSkillDraft(
  markdown: string,
  domains: KnowledgeDomain[],
  existing_proposals: SkillProposalRecord[],
  topic_key: string,
): SkillDraftValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { metadata, content } = parseFrontmatter(markdown);

  if (metadata == null) {
    return {
      valid: false,
      metadata: null,
      errors: ['Draft must start with YAML frontmatter and include at least `name` and `category`.'],
      warnings,
      generated_path: null,
    };
  }

  if (metadata.name.length === 0) {
    errors.push('Frontmatter `name` is required.');
  }

  if (metadata.category.length === 0) {
    errors.push('Frontmatter `category` is required.');
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.name)) {
    errors.push('Skill `name` must use lowercase kebab-case (example: artifact-signing).');
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.category)) {
    errors.push('Skill `category` must use lowercase kebab-case (example: backend or generic-dev).');
  }

  if (content.length === 0) {
    errors.push('Skill draft body must not be empty.');
  }

  if (markdown.length > 40000) {
    errors.push('Skill draft exceeds the 40k character safety limit.');
  }

  const available_skill_names = new Set(
    domains.filter((domain) => domain.target_type === 'skill').map((domain) => domain.name),
  );

  if (metadata.name.length > 0 && available_skill_names.has(metadata.name)) {
    errors.push(`Skill name ${metadata.name} already exists in the active skill catalog.`);
  }

  const conflicting_proposal = existing_proposals.find(
    (proposal) => proposal.topic_key !== topic_key && proposal.skill_name === metadata.name,
  );
  if (conflicting_proposal != null) {
    errors.push(`Skill name ${metadata.name} is already used by proposal ${conflicting_proposal.topic_key}.`);
  }

  const seen_dependencies = new Set<string>();
  for (const dependency of metadata.depends_on) {
    if (dependency === metadata.name) {
      errors.push('Skill cannot depend on itself.');
      continue;
    }

    if (seen_dependencies.has(dependency)) {
      errors.push(`Dependency ${dependency} is listed more than once.`);
      continue;
    }
    seen_dependencies.add(dependency);

    if (!available_skill_names.has(dependency)) {
      errors.push(`Dependency ${dependency} does not exist in the active skill catalog.`);
    }
  }

  if (metadata.description == null || metadata.description.trim().length < 12) {
    warnings.push('Skill description is very short; consider making the purpose more explicit.');
  }

  return {
    valid: errors.length === 0,
    metadata,
    errors,
    warnings,
    generated_path: errors.length === 0 ? getGeneratedSkillPath(metadata.category, metadata.name) : null,
  };
}
