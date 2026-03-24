/**
 * Helpers for safely reading phase output content from Supabase.
 *
 * phase_outputs.content can be either:
 * - a direct array, or
 * - a wrapper object that contains an array field (for example { tasks: [...] }).
 */

import type { RequirementItem } from './types/database';

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

function normalizePriority(value: unknown): RequirementItem['priority'] | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return normalized === 'HIGH' || normalized === 'MEDIUM' || normalized === 'LOW' ? normalized : null;
}

function summarizeRequirementTitle(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const fallbackFields = ['title', 'requirement', 'description', 'text', 'name', 'statement'];
    for (const field of fallbackFields) {
      const candidate = record[field];
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  return 'Untitled requirement';
}

export function getRequirementItems(content: unknown): RequirementItem[] {
  const rawItems = getPhaseOutputArray<unknown>(content, ['functional_requirements', 'requirements']);

  return rawItems.map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: `REQ-${index + 1}`,
        title: item.trim(),
        priority: 'MEDIUM',
      };
    }

    if (item != null && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      const id =
        typeof record.id === 'string' && record.id.trim().length > 0
          ? record.id.trim()
          : typeof record.requirement_id === 'string' && record.requirement_id.trim().length > 0
            ? record.requirement_id.trim()
            : `REQ-${index + 1}`;

      return {
        id,
        title: summarizeRequirementTitle(record),
        priority: normalizePriority(record.priority) ?? 'MEDIUM',
      };
    }

    return {
      id: `REQ-${index + 1}`,
      title: summarizeRequirementTitle(item),
      priority: 'MEDIUM',
    };
  });
}
