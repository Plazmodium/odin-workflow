'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { CATEGORY_COLORS } from '@/lib/constants';
import type { DomainCluster, BridgeLearning, LearningCategory } from '@/lib/types/database';
import { Network, ArrowRightLeft, Layers } from 'lucide-react';

interface DomainClusterMapProps {
  clusters: DomainCluster[];
  bridges: BridgeLearning[];
}

const TARGET_TYPE_ICONS: Record<string, string> = {
  skill: '📚',
  agent_definition: '🤖',
  agents_md: '📋',
};

function CategoryDot({ category }: { category: LearningCategory }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: CATEGORY_COLORS[category] ?? '#71717a' }}
    />
  );
}

export function DomainClusterMap({ clusters, bridges }: DomainClusterMapProps) {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  const totalLearnings = new Set(clusters.flatMap((c) => c.learnings.map((l) => l.id))).size;

  if (clusters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Network className="h-10 w-10 mb-3" />
        <p className="text-sm font-medium">No knowledge domains yet</p>
        <p className="text-xs mt-1">Domains appear when learnings are captured with domain_tags</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{clusters.length}</span>
          <span className="text-muted-foreground">domains</span>
        </div>
        <span className="text-border">|</span>
        <div>
          <span className="font-medium">{totalLearnings}</span>
          <span className="text-muted-foreground ml-1">learnings placed</span>
        </div>
        {bridges.length > 0 && (
          <>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{bridges.length}</span>
              <span className="text-muted-foreground">bridges</span>
            </div>
          </>
        )}
      </div>

      {/* Domain Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clusters.map((cluster) => {
          const isExpanded = expandedDomain === cluster.domain_key;
          const displayLearnings = isExpanded ? cluster.learnings : cluster.learnings.slice(0, 3);
          const hasMore = cluster.learnings.length > 3;

          return (
            <div
              key={cluster.domain_key}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              {/* Domain Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{TARGET_TYPE_ICONS[cluster.target_type] ?? '📄'}</span>
                  <span className="font-medium text-sm truncate">{cluster.domain_label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    {cluster.density}
                  </Badge>
                  {cluster.propagated_count > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 text-healthy border-healthy/30">
                      {cluster.propagated_count} ✓
                    </Badge>
                  )}
                </div>
              </div>

              {/* Learning List */}
              <div className="space-y-1.5">
                {displayLearnings.map((learning) => (
                  <Link
                    key={learning.id}
                    href={`/learnings/${learning.id}`}
                    className="flex items-center gap-2 text-xs rounded px-2 py-1.5 hover:bg-accent/50 transition-colors group"
                  >
                    <CategoryDot category={learning.category} />
                    <span className="truncate flex-1 text-muted-foreground group-hover:text-foreground">
                      {learning.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {Math.round(learning.confidence_score * 100)}%
                    </span>
                  </Link>
                ))}
              </div>

              {/* Show more/less */}
              {hasMore && (
                <button
                  onClick={() => setExpandedDomain(isExpanded ? null : cluster.domain_key)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left px-2"
                >
                  {isExpanded
                    ? '← Show less'
                    : `+ ${cluster.learnings.length - 3} more`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Bridges Section */}
      {bridges.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            Cross-Domain Bridges
          </h3>
          <div className="space-y-2">
            {bridges.map((bridge) => (
              <Link
                key={bridge.id}
                href={`/learnings/${bridge.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 hover:bg-accent/30 transition-colors"
              >
                <CategoryDot category={bridge.category} />
                <span className="text-sm flex-1 truncate">{bridge.title}</span>
                <div className="flex items-center gap-1">
                  {bridge.domains.map((d) => {
                    const [type] = d.split('|');
                    return (
                      <span key={d} className="text-base" title={d}>
                        {TARGET_TYPE_ICONS[type] ?? '📄'}
                      </span>
                    );
                  })}
                </div>
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {bridge.domains.length} domains
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
