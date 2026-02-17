import { Badge } from '@/components/ui/badge';
import type { FeatureStatus, EvalHealth, GateStatus, BlockerStatus, BlockerSeverity, AlertSeverity } from '@/lib/types/database';

interface StatusBadgeProps {
  status: FeatureStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = {
    IN_PROGRESS: 'secondary' as const,
    BLOCKED: 'critical' as const,
    COMPLETED: 'healthy' as const,
    CANCELLED: 'outline' as const,
  }[status] ?? 'outline' as const;

  return <Badge variant={variant} className={className}>{status.replace('_', ' ')}</Badge>;
}

interface HealthBadgeProps {
  status: EvalHealth | null | undefined;
  className?: string;
}

export function HealthBadge({ status, className }: HealthBadgeProps) {
  if (!status) return <Badge variant="outline" className={className}>No Data</Badge>;
  const variant = {
    HEALTHY: 'healthy' as const,
    CONCERNING: 'concerning' as const,
    CRITICAL: 'critical' as const,
  }[status];
  return <Badge variant={variant} className={className}>{status}</Badge>;
}

interface GateBadgeProps {
  status: GateStatus;
  className?: string;
}

export function GateBadge({ status, className }: GateBadgeProps) {
  const variant = {
    PENDING: 'concerning' as const,
    APPROVED: 'healthy' as const,
    REJECTED: 'critical' as const,
  }[status];
  return <Badge variant={variant} className={className}>{status}</Badge>;
}

interface BlockerStatusBadgeProps {
  status: BlockerStatus;
  className?: string;
}

export function BlockerStatusBadge({ status, className }: BlockerStatusBadgeProps) {
  const variant = {
    OPEN: 'critical' as const,
    IN_PROGRESS: 'concerning' as const,
    RESOLVED: 'healthy' as const,
    ESCALATED: 'destructive' as const,
  }[status] ?? 'outline' as const;
  return <Badge variant={variant} className={className}>{status.replace('_', ' ')}</Badge>;
}

interface SeverityBadgeProps {
  severity: BlockerSeverity | AlertSeverity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const variant = {
    LOW: 'outline' as const,
    MEDIUM: 'concerning' as const,
    HIGH: 'concerning' as const,
    WARNING: 'concerning' as const,
    CRITICAL: 'critical' as const,
  }[severity] ?? 'outline' as const;
  return <Badge variant={variant} className={className}>{severity}</Badge>;
}
