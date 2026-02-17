export const dynamic = 'force-dynamic';

import {
  getSystemHealthHistory,
  getLatestSystemHealthAllPeriods,
  getAgentEvals,
  getAlertHistory,
} from '@/lib/data/evals';
import { getRecentAuditLog } from '@/lib/data/audit';
import { refreshSystemHealth } from '@/lib/actions/refresh-evals';
import { HealthTrendChart } from '@/components/evals/health-trend-chart';
import { PeriodComparison } from '@/components/evals/period-comparison';
import { AgentPerformance } from '@/components/evals/agent-performance';
import { AlertHistoryTable } from '@/components/evals/alert-history-table';
import { AuditTimeline } from '@/components/features/audit-timeline';
import { RefreshEvalsButton } from '@/components/shared/refresh-evals-button';
import { PanelInfoTooltip } from '@/components/shared/panel-info-tooltip';
import { PollingSubscription } from '@/components/realtime/realtime-page';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default async function EvalsPage() {
  const [history, latestPeriods, agentEvals, alertHistory, recentActivity] = await Promise.all([
    getSystemHealthHistory(7),
    getLatestSystemHealthAllPeriods(),
    getAgentEvals(),
    getAlertHistory(100),
    getRecentAuditLog(50),
  ]);

  return (
    <>
    <PollingSubscription />
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">EVALS History</h1>
          <p className="text-sm text-muted-foreground">
            System health trends, agent performance, and alert history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshEvalsButton
            action={refreshSystemHealth.bind(null, 7)}
            label="Refresh 7-day"
          />
          <RefreshEvalsButton
            action={refreshSystemHealth.bind(null, 30)}
            label="Refresh 30-day"
          />
          <RefreshEvalsButton
            action={refreshSystemHealth.bind(null, 90)}
            label="Refresh 90-day"
          />
        </div>
      </div>

      {/* Period Comparison Cards */}
      <PeriodComparison periods={latestPeriods} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <HealthTrendChart history={history} periodDays={7} />
        <AgentPerformance agentEvals={agentEvals} />
      </div>

      {/* Alert History */}
      <AlertHistoryTable alerts={alertHistory} />

      {/* System Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            System Activity ({recentActivity.length})
            <PanelInfoTooltip text="Recent audit log entries across all features. Shows phase transitions, gate approvals, blocker changes, and other workflow events." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AuditTimeline entries={recentActivity} showFeatureLink />
        </CardContent>
      </Card>
    </div>
    </>
  );
}
