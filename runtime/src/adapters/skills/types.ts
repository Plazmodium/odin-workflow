/**
 * Skill Adapter Types
 * Version: 0.1.0
 */

import type { FeatureRecord, KnowledgeDomain, PhaseArtifact, ResolvedSkill } from '../../types.js';

export interface ResolveSkillsInput {
  feature: FeatureRecord;
  artifacts: PhaseArtifact[];
}

export interface ResolveSkillsResult {
  resolved: ResolvedSkill[];
  fallback_used: boolean;
}

export interface SkillAdapter {
  resolveSkills(input: ResolveSkillsInput): Promise<ResolveSkillsResult>;
  listKnowledgeDomains(): Promise<KnowledgeDomain[]>;
}
