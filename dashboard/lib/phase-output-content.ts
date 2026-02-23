/**
 * Helpers for safely reading phase output content from Supabase.
 *
 * phase_outputs.content can be either:
 * - a direct array, or
 * - a wrapper object that contains an array field (for example { tasks: [...] }).
 */

export function getPhaseOutputArray<T>(content: unknown, arrayKeys: string[] = []): T[] {
  if (Array.isArray(content)) return content as T[];

  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>;
    for (const key of arrayKeys) {
      const nested = record[key];
      if (Array.isArray(nested)) return nested as T[];
    }
  }

  return [];
}
