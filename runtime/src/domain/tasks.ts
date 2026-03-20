/**
 * Task Artifact Helpers
 * Version: 0.1.0
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTaskStatus(status: unknown): 'pending' | 'in_progress' | 'completed' {
  if (status === 'completed' || status === 'done') {
    return 'completed';
  }

  if (status === 'in_progress' || status === 'in-progress') {
    return 'in_progress';
  }

  return 'pending';
}

function completeTaskItem(value: unknown): { changed: boolean; value: unknown } {
  if (!isRecord(value)) {
    return { changed: false, value };
  }

  const previous_status = normalizeTaskStatus(value.status);
  if (previous_status === 'completed') {
    return { changed: false, value: { ...value, status: 'completed' } };
  }

  return {
    changed: true,
    value: { ...value, status: 'completed' },
  };
}

export function completeTaskArtifactContent(content: unknown): { changed: boolean; content: unknown } {
  if (Array.isArray(content)) {
    let changed = false;
    const next = content.map((item) => {
      const result = completeTaskItem(item);
      changed = changed || result.changed;
      return result.value;
    });

    return { changed, content: next };
  }

  if (isRecord(content) && Array.isArray(content.tasks)) {
    let changed = false;
    const tasks = content.tasks.map((item) => {
      const result = completeTaskItem(item);
      changed = changed || result.changed;
      return result.value;
    });

    return {
      changed,
      content: {
        ...content,
        tasks,
      },
    };
  }

  return { changed: false, content };
}
