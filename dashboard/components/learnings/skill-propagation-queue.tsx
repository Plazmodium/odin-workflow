'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CATEGORY_COLORS } from '@/lib/constants';
import { formatConfidence, truncate } from '@/lib/utils';
import { EmptyState } from '@/components/layout/empty-state';
import { ArrowUpCircle, FileCode, BookOpen, FileText, CheckCircle2, Clock } from 'lucide-react';
import type { SkillPropagationItem, SkillPropagationItemWithStatus, PropagationTargetType } from '@/lib/types/database';

interface SkillPropagationQueueProps {
  items: (SkillPropagationItem | SkillPropagationItemWithStatus)[];
}

const TARGET_TYPE_CONFIG: Record<
  PropagationTargetType,
  { label: string; icon: typeof FileCode; color: string }
> = {
  agents_md: {
    label: 'AGENTS.md',
    icon: FileText,
    color: 'text-blue-400 bg-blue-400/10',
  },
  skill: {
    label: 'Skill',
    icon: FileCode,
    color: 'text-violet-400 bg-violet-400/10',
  },
  agent_definition: {
    label: 'Agent Def',
    icon: BookOpen,
    color: 'text-amber-400 bg-amber-400/10',
  },
};

type FilterType = 'all' | PropagationTargetType;

export function SkillPropagationQueue({ items }: SkillPropagationQueueProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'propagated' | 'pending'>('all');

  const typeFiltered =
    filter === 'all' ? items : items.filter((i) => i.target_type === filter);
  const filtered = statusFilter === 'all'
    ? typeFiltered
    : typeFiltered.filter((i) => {
        const isPropagated = 'is_propagated' in i && i.is_propagated;
        return statusFilter === 'propagated' ? isPropagated : !isPropagated;
      });

  // Count per type
  const counts: Record<FilterType, number> = {
    all: items.length,
    agents_md: items.filter((i) => i.target_type === 'agents_md').length,
    skill: items.filter((i) => i.target_type === 'skill').length,
    agent_definition: items.filter((i) => i.target_type === 'agent_definition')
      .length,
  };

  const propagatedCount = items.filter((i) => 'is_propagated' in i && i.is_propagated).length;
  const pendingCount = items.length - propagatedCount;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ArrowUpCircle className="h-8 w-8" />}
        title="No propagation targets declared"
        description="Learnings need declared targets, confidence >= 80%, and relevance >= 60% to appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bars */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'agents_md', label: 'AGENTS.md' },
              { key: 'skill', label: 'Skills' },
              { key: 'agent_definition', label: 'Agent Defs' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              {counts[key] > 0 && (
                <span className="ml-1.5 tabular-nums">({counts[key]})</span>
              )}
            </button>
          ))}
        </div>
        <span className="text-border">|</span>
        <div className="flex items-center gap-2">
          {(
            [
              { key: 'all', label: 'All Status' },
              { key: 'propagated', label: `Propagated (${propagatedCount})` },
              { key: 'pending', label: `Pending (${pendingCount})` },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {filtered.map((item, idx) => {
          const categoryColor =
            CATEGORY_COLORS[item.category] ?? '#71717a';
          const targetConfig = TARGET_TYPE_CONFIG[item.target_type];
          const TargetIcon = targetConfig.icon;

          return (
            <Card key={`${item.learning_id}-${item.target_type}-${item.target_path ?? 'default'}-${idx}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Category + Target badges */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-white shrink-0"
                        style={{ backgroundColor: categoryColor }}
                      >
                        {item.category}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${targetConfig.color}`}
                      >
                        <TargetIcon className="h-3 w-3" />
                        {targetConfig.label}
                        {item.target_path && (
                          <span className="opacity-70">
                            : {item.target_path}
                          </span>
                        )}
                      </span>
                    </div>

                    <h4 className="text-sm font-medium leading-snug">
                      {item.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {truncate(item.content, 200)}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      {item.feature_id && <span>{item.feature_id}</span>}
                      <span>
                        Relevance: {(item.relevance_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Status + Confidence */}
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-lg font-bold tabular-nums text-healthy">
                      {formatConfidence(item.confidence_score)}
                    </p>
                    {'is_propagated' in item && (
                      <div className={`flex items-center gap-1 text-[10px] font-medium justify-end ${
                        item.is_propagated ? 'text-healthy' : 'text-concerning'
                      }`}>
                        {item.is_propagated ? (
                          <><CheckCircle2 className="h-3 w-3" /> Propagated</>
                        ) : (
                          <><Clock className="h-3 w-3" /> Pending</>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No items match the selected filter.
        </p>
      )}
    </div>
  );
}
