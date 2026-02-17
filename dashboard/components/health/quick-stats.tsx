import { StatCard } from '@/components/shared/stat-card';
import { Activity, AlertTriangle, CheckCircle, XCircle, ShieldAlert } from 'lucide-react';

interface QuickStatsProps {
  inProgress: number;
  blocked: number;
  completed: number;
  openAlerts: number;
  openBlockers: number;
}

export function QuickStats({ inProgress, blocked, completed, openAlerts, openBlockers }: QuickStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <StatCard
        label="In Progress"
        value={inProgress}
        icon={<Activity className="h-4 w-4" />}
      />
      <StatCard
        label="Blocked"
        value={blocked}
        icon={<XCircle className="h-4 w-4 text-critical" />}
      />
      <StatCard
        label="Completed"
        value={completed}
        icon={<CheckCircle className="h-4 w-4 text-healthy" />}
      />
      <StatCard
        label="Open Alerts"
        value={openAlerts}
        icon={<AlertTriangle className="h-4 w-4 text-concerning" />}
      />
      <StatCard
        label="Open Blockers"
        value={openBlockers}
        icon={<ShieldAlert className="h-4 w-4 text-critical" />}
      />
    </div>
  );
}
