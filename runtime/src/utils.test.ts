import { describe, expect, it } from 'vitest';

import { safeToolHandler } from './utils.js';

describe('safeToolHandler', () => {
  it('returns an explicit error result when the handler throws', async () => {
    const wrapped = safeToolHandler(async () => {
      throw new Error('boom');
    });

    const result = await wrapped({});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('boom');
  });
});
