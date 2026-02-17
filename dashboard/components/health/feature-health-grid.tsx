import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { PhaseBadge } from '@/components/shared/phase-badge';
import { HealthBadge, StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/layout/empty-state';
import { formatDuration, formatScore } from '@/lib/utils';
import { Layers } from 'lucide-react';
import type { FeatureHealthOverview } from '@/lib/types/database';

interface FeatureHealthGridProps {
  features: FeatureHealthOverview[];
}

export function FeatureHealthGrid({ features }: FeatureHealthGridProps) {
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {features.map((feature) => (
        <Link key={feature.feature_id} href={`/features/${feature.feature_id}`}>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{feature.feature_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{feature.feature_id}</p>
                </div>
                <HealthBadge status={feature.health_status} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <PhaseBadge phase={feature.current_phase} />
                <StatusBadge status={feature.feature_status} />
                <span className="text-xs text-muted-foreground">
                  L{feature.complexity_level}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Score: <span className="text-foreground font-medium">{formatScore(feature.overall_score)}</span>
                </span>
                <span>{formatDuration(feature.total_duration_ms)}</span>
                {feature.active_alerts > 0 && (
                  <span className="text-critical">{feature.active_alerts} alerts</span>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
