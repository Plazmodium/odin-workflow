'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { PhaseBadge } from '@/components/shared/phase-badge';
import { StatusBadge, HealthBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/layout/empty-state';
import { formatDuration, formatScore, formatRelativeTime } from '@/lib/utils';
import { Layers, GitBranch, GitPullRequest, GitMerge, ExternalLink, User } from 'lucide-react';
import type { AllFeatureSummary, FeatureStatus } from '@/lib/types/database';

type StatusFilter = 'ALL' | FeatureStatus;

interface FeaturesTableProps {
  features: AllFeatureSummary[];
}

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'IN_PROGRESS' },
  { label: 'Blocked', value: 'BLOCKED' },
  { label: 'Completed', value: 'COMPLETED' },
];

function GitIndicator({ feature }: { feature: AllFeatureSummary }) {
  if (feature.merged_at) {
    return (
      <span className="text-healthy" title="Merged">
        <GitMerge className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (feature.pr_url) {
    return (
      <a
        href={feature.pr_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300"
        title={`PR #${feature.pr_number}`}
        onClick={(e) => e.stopPropagation()}
      >
        <GitPullRequest className="h-3.5 w-3.5" />
      </a>
    );
  }
  if (feature.branch_name) {
    return (
      <span className="text-muted-foreground" title={feature.branch_name}>
        <GitBranch className="h-3.5 w-3.5" />
      </span>
    );
  }
  return <span className="text-muted-foreground/30">—</span>;
}

export function FeaturesTable({ features }: FeaturesTableProps) {
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  const filtered = filter === 'ALL'
    ? features
    : features.filter((f) => f.feature_status === filter);

  // Counts for filter tabs
  const counts: Record<StatusFilter, number> = {
    ALL: features.length,
    IN_PROGRESS: features.filter((f) => f.feature_status === 'IN_PROGRESS').length,
    BLOCKED: features.filter((f) => f.feature_status === 'BLOCKED').length,
    COMPLETED: features.filter((f) => f.feature_status === 'COMPLETED').length,
    CANCELLED: features.filter((f) => f.feature_status === 'CANCELLED').length,
  };

  if (features.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="h-8 w-8" />}
        title="No features tracked yet"
        description="Create a feature using Odin's workflow to see it here"
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        {STATUS_FILTERS.map((sf) => {
          const count = counts[sf.value];
          if (sf.value !== 'ALL' && count === 0) return null;
          return (
            <button
              key={sf.value}
              onClick={() => setFilter(sf.value)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                filter === sf.value
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              {sf.label}
              <span className="ml-1.5 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Feature</th>
                  <th className="px-4 py-3 font-medium">Author</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Phase</th>
                  <th className="px-4 py-3 font-medium text-center">Level</th>
                  <th className="px-4 py-3 font-medium">Health</th>
                  <th className="px-4 py-3 font-medium text-right">Score</th>
                  <th className="px-4 py-3 font-medium text-right">Duration</th>
                  <th className="px-4 py-3 font-medium text-center">Git</th>
                  <th className="px-4 py-3 font-medium text-right">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((feature) => (
                  <tr
                    key={feature.feature_id}
                    className="border-b border-border/50 hover:bg-accent/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/features/${feature.feature_id}`}
                        className="group flex items-center gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[240px] group-hover:text-primary transition-colors">
                            {feature.feature_name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {feature.feature_id}
                          </p>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {feature.author ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {feature.author}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={feature.feature_status} />
                    </td>
                    <td className="px-4 py-3">
                      <PhaseBadge phase={feature.current_phase} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-medium">L{feature.complexity_level}</span>
                    </td>
                    <td className="px-4 py-3">
                      <HealthBadge status={feature.health_status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatScore(feature.overall_score)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                      {formatDuration(feature.total_duration_ms)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <GitIndicator feature={feature} />
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(feature.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No features match this filter
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
