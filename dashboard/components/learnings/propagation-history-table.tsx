/**
 * PropagationHistoryTable
 *
 * Display-only table showing completed propagations (past tense).
 * No action buttons — propagation is done by AI agents during the workflow.
 */

import { CheckCircle, FileText, Brain, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CATEGORY_COLORS } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/utils';
import { EmptyState } from '@/components/layout/empty-state';
import type { PropagationHistoryItem } from '@/lib/types/database';

interface PropagationHistoryTableProps {
  items: PropagationHistoryItem[];
}

const TARGET_TYPE_CONFIG: Record<
  string,
  { icon: typeof FileText; label: string; color: string }
> = {
  agents_md: {
    icon: FileText,
    label: 'AGENTS.md',
    color: 'text-blue-400',
  },
  skill: {
    icon: BookOpen,
    label: 'Skill',
    color: 'text-violet-400',
  },
  agent_definition: {
    icon: Brain,
    label: 'Agent Definition',
    color: 'text-amber-400',
  },
};

function getTargetConfig(targetType: string) {
  return (
    TARGET_TYPE_CONFIG[targetType] ?? {
      icon: FileText,
      label: targetType,
      color: 'text-muted-foreground',
    }
  );
}

export function PropagationHistoryTable({
  items,
}: PropagationHistoryTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle className="h-8 w-8" />}
        title="No propagations yet"
        description="Propagations are recorded when AI agents write learnings to AGENTS.md, skills, or agent definitions during the workflow."
      />
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const config = getTargetConfig(item.target_type);
        const Icon = config.icon;
        const categoryColor =
          CATEGORY_COLORS[item.learning_category] ?? '#71717a';

        return (
          <Card key={item.id}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {/* Status icon */}
                <CheckCircle className="h-4 w-4 text-healthy shrink-0" />

                {/* Target info */}
                <div className="flex items-center gap-2 shrink-0">
                  <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                  <span className="text-xs font-medium">{config.label}</span>
                  {item.target_path && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {item.target_path}
                    </span>
                  )}
                </div>

                {/* Separator */}
                <span className="text-border">|</span>

                {/* Learning info */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-white shrink-0"
                    style={{ backgroundColor: categoryColor }}
                  >
                    {item.learning_category}
                  </span>
                  <Link
                    href={`/learnings/${item.learning_id}`}
                    className="text-xs hover:underline truncate"
                  >
                    {item.learning_title}
                  </Link>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                  <span>by {item.propagated_by}</span>
                  <span>{formatRelativeTime(item.propagated_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
