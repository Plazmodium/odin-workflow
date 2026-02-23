import { GateBadge } from '@/components/shared/status-badge';
import { PhaseBadge } from '@/components/shared/phase-badge';
import { EmptyState } from '@/components/layout/empty-state';
import { formatDateTime } from '@/lib/utils';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { FeatureStatus, QualityGate } from '@/lib/types/database';

interface QualityGatesTableProps {
  gates: QualityGate[];
  featureStatus: FeatureStatus;
}

export function QualityGatesTable({ gates, featureStatus }: QualityGatesTableProps) {
  if (gates.length === 0) {
    if (featureStatus === 'COMPLETED') {
      return (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Missing quality gate"
          description="Feature is completed but no Guardian approval gate is recorded"
        />
      );
    }

    return (
      <EmptyState
        icon={<ShieldCheck className="h-6 w-6" />}
        title="No quality gates"
        description="No Guardian reviews recorded for this feature"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-4">Gate</th>
            <th className="pb-2 pr-4">Phase</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2 pr-4">Approver</th>
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {gates.map((gate) => (
            <tr key={gate.id} className="border-b border-border/50">
              <td className="py-2 pr-4 font-medium">{gate.gate_name}</td>
              <td className="py-2 pr-4"><PhaseBadge phase={gate.phase} /></td>
              <td className="py-2 pr-4"><GateBadge status={gate.status} /></td>
              <td className="py-2 pr-4 text-muted-foreground">{gate.approver}</td>
              <td className="py-2 pr-4 text-muted-foreground">{formatDateTime(gate.approved_at)}</td>
              <td className="py-2 text-muted-foreground text-xs max-w-xs truncate">
                {gate.approval_notes ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
