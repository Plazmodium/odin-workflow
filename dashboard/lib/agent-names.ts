import type { Phase } from './types/database';

const PHASE_AGENT_NAMES: Record<Phase, string> = {
  '0': 'planning-agent',
  '1': 'product-agent',
  '2': 'discovery-agent',
  '3': 'architect-agent',
  '4': 'guardian-agent',
  '5': 'builder-agent',
  '6': 'reviewer-agent',
  '7': 'integrator-agent',
  '8': 'documenter-agent',
  '9': 'release-agent',
  '10': 'complete-agent',
};

const HARNESS_IDENTITIES = new Set([
  'opencode',
  'open-code',
  'codex',
  'claude',
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

export function normalizeWorkflowAgentLabel(agentName: string, phase: Phase, operation?: string | null): string {
  const normalized = normalizeActor(agentName);
  const phaseAgent = PHASE_AGENT_NAMES[phase];
  const phaseRoleAlias = phaseAgent.replace(/-agent$/, '');

  if (
    normalized.length === 0 ||
    normalized === phaseRoleAlias ||
    HARNESS_IDENTITIES.has(normalized) ||
    MODEL_IDENTITY_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    operation?.includes('(fallback)')
  ) {
    return phaseAgent;
  }

  return agentName;
}
