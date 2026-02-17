import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PanelInfoTooltip } from '@/components/shared/panel-info-tooltip';
import { EmptyState } from '@/components/layout/empty-state';
import { formatConfidence } from '@/lib/utils';
import { Brain, ArrowRight } from 'lucide-react';
import type { ActiveLearning, LearningCategory } from '@/lib/types/database';

interface LearningSummaryProps {
  learnings: ActiveLearning[];
  stats: {
    total: number;
    highConfidence: number;
    openConflicts: number;
    propagated: number;
  };
}

function categoryVariant(category: LearningCategory) {
  const map: Record<LearningCategory, 'secondary' | 'outline' | 'default'> = {
    DECISION: 'secondary',
    PATTERN: 'secondary',
    GOTCHA: 'secondary',
    CONVENTION: 'secondary',
    ARCHITECTURE: 'secondary',
    RATIONALE: 'secondary',
    OPTIMIZATION: 'secondary',
    INTEGRATION: 'secondary',
  };
  return map[category] ?? 'outline';
}

function confidenceColor(score: number): string {
  if (score >= 0.9) return 'text-healthy';
  if (score >= 0.8) return 'text-blue-400';
  if (score >= 0.6) return 'text-concerning';
  return 'text-muted-foreground';
}

export function LearningSummary({ learnings, stats }: LearningSummaryProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-muted-foreground" />
            Recent Learnings
            <PanelInfoTooltip text="Insights captured during development. High-confidence learnings (≥ 0.80) can be propagated to skill files or your agent's init file (CLAUDE.md, AGENTS.md, WARP.md, etc)." />
          </CardTitle>
          <Link
            href="/learnings"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs pt-1">
          <span>
            <span className="font-medium">{stats.total}</span>
            <span className="text-muted-foreground ml-1">active</span>
          </span>
          <span className="text-border">|</span>
          <span>
            <span className="font-medium text-healthy">{stats.highConfidence}</span>
            <span className="text-muted-foreground ml-1">high confidence</span>
          </span>
          <span className="text-border">|</span>
          <span>
            <span className={`font-medium ${stats.openConflicts > 0 ? 'text-critical' : ''}`}>
              {stats.openConflicts}
            </span>
            <span className="text-muted-foreground ml-1">conflicts</span>
          </span>
          <span className="text-border">|</span>
          <span>
            <span className={`font-medium ${stats.propagated > 0 ? 'text-healthy' : ''}`}>
              {stats.propagated}
            </span>
            <span className="text-muted-foreground ml-1">propagated</span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {learnings.length === 0 ? (
          <EmptyState
            icon={<Brain className="h-6 w-6" />}
            title="No learnings yet"
            description="Learnings are created during the SDD workflow"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Category</th>
                  <th className="pb-2 pr-4 font-medium">Title</th>
                  <th className="pb-2 pr-4 font-medium text-right">Confidence</th>
                  <th className="pb-2 font-medium">Feature</th>
                </tr>
              </thead>
              <tbody>
                {learnings.map((l) => (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">
                      <Badge variant={categoryVariant(l.category)} className="text-[10px]">
                        {l.category}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="truncate block max-w-[320px]" title={l.title}>
                        {l.title}
                      </span>
                    </td>
                    <td className={`py-2 pr-4 text-right font-medium tabular-nums ${confidenceColor(l.confidence_score)}`}>
                      {formatConfidence(l.confidence_score)}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground font-mono">
                      {l.feature_id ? (
                        <Link
                          href={`/features/${l.feature_id}`}
                          className="hover:text-foreground transition-colors"
                        >
                          {l.feature_id}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
