/**
 * Workflow Actor Helpers
 * Version: 0.1.0
 */

import type { PhaseId } from '../types.js';
import { getPhaseAgentInstructions } from './phases.js';

const HARNESS_IDENTITIES = new Set([
  'opencode',
  'open code',
  'codex',
  'claude',
  'claude code',
  'claude-code',
  'amp',
  'generic',
  'assistant',
  'developer',
]);

function normalizeActor(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, '-');
}

export function isHarnessIdentity(value: string): boolean {
  const normalized = normalizeActor(value);
  return HARNESS_IDENTITIES.has(normalized) || HARNESS_IDENTITIES.has(normalized.replace(/-/g, ' '));
}

export function validateHumanAuthor(author: string): string | null {
  const trimmed = author.trim();

  if (trimmed.length === 0) {
    return 'Feature author is required. Use the real human developer name, not an empty value.';
  }

  if (isHarnessIdentity(trimmed) || normalizeActor(trimmed).endsWith('-agent')) {
    return `Feature author must be a real human name. Received "${trimmed}", which looks like a harness or agent label. Check git config or ask the developer for their name, then retry odin.start_feature.`;
  }

  return null;
}

export function resolveWorkflowActorName(phase: PhaseId, created_by: string): string {
  const trimmed = created_by.trim();
  if (trimmed.length === 0 || isHarnessIdentity(trimmed)) {
    return getPhaseAgentInstructions(phase).name;
  }

  return trimmed;
}
