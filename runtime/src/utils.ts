/**
 * Odin Runtime Utilities
 * Version: 0.1.0
 */

import { randomUUID } from 'node:crypto';

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: { [x: string]: unknown };
  isError?: boolean;
};

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown runtime error occurred.';
}

export function createTextResult(
  text: string,
  structured_content?: { [x: string]: unknown }
): ToolResult {
  if (structured_content == null) {
    return {
      content: [{ type: 'text' as const, text }],
    };
  }

  return {
    content: [{ type: 'text' as const, text }],
    structuredContent: structured_content,
  };
}

export function createErrorResult(
  text: string,
  structured_content?: { [x: string]: unknown }
): ToolResult {
  if (structured_content == null) {
    return {
      content: [{ type: 'text' as const, text }],
      isError: true,
    };
  }

  return {
    content: [{ type: 'text' as const, text }],
    structuredContent: structured_content,
    isError: true,
  };
}

export function safeToolHandler<Input>(
  handler: (input: Input) => Promise<ToolResult>
): (input: Input) => Promise<ToolResult> {
  return async (input: Input) => {
    try {
      return await handler(input);
    } catch (error) {
      console.error('[Odin Runtime] Tool handler failed:', error);
      return createErrorResult(getErrorMessage(error));
    }
  };
}
