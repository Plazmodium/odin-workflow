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

const MODEL_IDENTITY_PATTERNS: RegExp[] = [
  /(^|\/)gpt-[a-z0-9._-]+$/,
  /(^|\/)claude-[a-z0-9._-]+$/,
  /(^|\/)gemini-[a-z0-9._-]+$/,
  /(^|\/)o[1-9][a-z0-9._-]*$/,
  /(^|\/)deepseek-[a-z0-9._-]+$/,
  /(^|\/)llama-[a-z0-9._-]+$/,
  /(^|\/)mistral-[a-z0-9._-]+$/,
  /(^|\/)qwen-[a-z0-9._-]+$/,
];

function normalizeActor(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, '-');
}

export function isHarnessIdentity(value: string): boolean {
  const normalized = normalizeActor(value);
  return (
    HARNESS_IDENTITIES.has(normalized) ||
    HARNESS_IDENTITIES.has(normalized.replace(/-/g, ' ')) ||
    MODEL_IDENTITY_PATTERNS.some((pattern) => pattern.test(normalized))
  );
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

export function resolveNamedActorName(default_actor: string, provided_actor?: string): string {
  const trimmed = provided_actor?.trim() ?? '';
  if (trimmed.length === 0 || isHarnessIdentity(trimmed)) {
    return default_actor;
  }

  if (normalizeActor(trimmed) === normalizeActor(default_actor.replace(/-agent$/, ''))) {
    return default_actor;
  }

  return trimmed;
}

export function resolveWorkflowActorName(phase: PhaseId, created_by: string): string {
  return resolveNamedActorName(getPhaseAgentInstructions(phase).name, created_by);
}
