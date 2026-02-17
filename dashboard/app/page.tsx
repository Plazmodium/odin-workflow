export const dynamic = 'force-dynamic';

import { getLatestSystemHealth, getAllFeaturesSummary, getActiveAlerts, getQuickStats, getActiveLearningStats, getRecentLearnings } from '@/lib/data/health';
import { refreshSystemHealth } from '@/lib/actions/refresh-evals';
import { HealthGauge } from '@/components/shared/health-gauge';
import { RefreshEvalsButton } from '@/components/shared/refresh-evals-button';
import { AlertsPanel } from '@/components/health/alerts-panel';
import { FeaturesTable } from '@/components/health/features-table';
import { LearningSummary } from '@/components/health/learnings-summary';
import { QuickStats } from '@/components/health/quick-stats';
import { PollingSubscription } from '@/components/realtime/realtime-page';
import { SoundNotificationWatcher } from '@/components/sound/sound-notification-watcher';
import { PanelInfoTooltip } from '@/components/shared/panel-info-tooltip';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatRelativeTime, safeJsonValue } from '@/lib/utils';

export default async function HealthOverviewPage() {
  const [systemHealth, features, alerts, quickStats, learningStats, recentLearnings] = await Promise.all([
    getLatestSystemHealth(7),
    getAllFeaturesSummary(),
    getActiveAlerts(),
    getQuickStats(),
    getActiveLearningStats(),
    getRecentLearnings(5),
  ]);

  return (
    <>
    <PollingSubscription />
    <SoundNotificationWatcher
      features={features.map((f) => ({ id: f.feature_id, status: f.feature_status }))}
    />
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Health Overview</h1>
          <p className="text-sm text-muted-foreground">
            System health and feature status at a glance
          </p>
        </div>
        <div className="flex items-center gap-3">
          {systemHealth && (
            <span className="text-xs text-muted-foreground">
              Last computed {formatRelativeTime(systemHealth.computed_at)}
            </span>
          )}
          <RefreshEvalsButton action={refreshSystemHealth.bind(null, 7)} />
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStats {...quickStats} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* System Health Gauge */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-1.5">
              System Health (7-day)
              <PanelInfoTooltip text="Overall workflow health computed from recent feature completions. Thrashing indicates repeated phase rework without forward progress — e.g., cycling between Guardian rejection and Builder fixes." />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <HealthGauge
              score={systemHealth?.overall_health_score ?? null}
              status={systemHealth?.health_status ?? null}
              size="lg"
            />
            {systemHealth && (
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Completed: </span>
                  <span className="font-medium">
                    {safeJsonValue(systemHealth.workflow_metrics as Record<string, unknown>, 'features_completed', 0)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">In Progress: </span>
                  <span className="font-medium">
                    {safeJsonValue(systemHealth.workflow_metrics as Record<string, unknown>, 'features_in_progress', 0)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Iterations: </span>
                  <span className="font-medium">
                    {safeJsonValue(systemHealth.quality_metrics as Record<string, unknown>, 'avg_iterations_to_approval', 0)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Thrashing Rate: </span>
                  <span className="font-medium">
                    {(safeJsonValue(systemHealth.quality_metrics as Record<string, unknown>, 'thrashing_rate', 0) as number * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts Panel */}
        <div className="xl:col-span-2 h-full">
          <AlertsPanel alerts={alerts} />
        </div>
      </div>

      {/* Features Table */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Features</h2>
        <FeaturesTable features={features} />
      </div>

      {/* Learnings Summary */}
      <LearningSummary learnings={recentLearnings} stats={learningStats} />
    </div>
    </>
  );
}
