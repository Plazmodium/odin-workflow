import { describe, expect, it } from 'vitest';

import { isHarnessIdentity, resolveWorkflowActorName, validateHumanAuthor } from './actors.js';

describe('workflow actor normalization', () => {
  it('treats model-style harness labels as harness identities', () => {
    expect(isHarnessIdentity('gpt-5.3-codex')).toBe(true);
    expect(isHarnessIdentity('openai/gpt-5.3-codex')).toBe(true);
    expect(isHarnessIdentity('claude-sonnet-4-5')).toBe(true);
    expect(isHarnessIdentity('o3')).toBe(true);
  });

  it('maps model-style labels back to the workflow phase agent', () => {
    expect(resolveWorkflowActorName('5', 'gpt-5.3-codex')).toBe('builder-agent');
    expect(resolveWorkflowActorName('6', 'openai/gpt-5.3-codex')).toBe('reviewer-agent');
    expect(resolveWorkflowActorName('1', 'product')).toBe('product-agent');
  });

  it('rejects model-style labels as human authors', () => {
    expect(validateHumanAuthor('gpt-5.3-codex')).toContain('real human name');
  });
});
