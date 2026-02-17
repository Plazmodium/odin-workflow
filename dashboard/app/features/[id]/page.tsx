export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import {
  getFeatureStatus,
  getFeatureCommits,
  getPhaseDurations,
  getAgentDurations,
  getAgentInvocations,
  getQualityGates,
  getBlockers,
  getFeatureEval,
  getFeatureLearnings,
  getTransitions,
  getIterationTracking,
  getPhaseOutputs,
} from '@/lib/data/features';
import { getFeatureArchive } from '@/lib/data/archives';
import { getFeatureAuditLog } from '@/lib/data/audit';
import { refreshFeatureEval } from '@/lib/actions/refresh-evals';
import { FeatureHeader } from '@/components/features/feature-header';
import { PhaseTimelineEnhanced } from '@/components/features/phase-timeline-enhanced';
import { AgentProfiler } from '@/components/features/agent-profiler';
import { QualityGatesTable } from '@/components/features/quality-gates-table';
import { BlockersTable } from '@/components/features/blockers-table';
import { EvalBreakdown } from '@/components/features/eval-breakdown';
import { TransitionHistory } from '@/components/features/transition-history';
import { CommitsTable } from '@/components/features/commits-table';
import { AuditTimeline } from '@/components/features/audit-timeline';
import { ArchivesSection } from '@/components/features/archives-section';
import { RefreshEvalsButton } from '@/components/shared/refresh-evals-button';
import { PollingSubscription } from '@/components/realtime/realtime-page';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatConfidence } from '@/lib/utils';
import Link from 'next/link';

interface FeatureDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function FeatureDetailPage({ params }: FeatureDetailPageProps) {
  const { id } = await params;

  const feature = await getFeatureStatus(id);
  if (!feature) notFound();

  const [phases, agents, invocations, gates, blockers, eval_, learnings, transitions, iterations, commits, auditLog, phaseOutputs, archive] =
    await Promise.all([
      getPhaseDurations(id),
      getAgentDurations(id),
      getAgentInvocations(id),
      getQualityGates(id),
      getBlockers(id),
      getFeatureEval(id),
      getFeatureLearnings(id),
      getTransitions(id),
      getIterationTracking(id),
      getFeatureCommits(id),
      getFeatureAuditLog(id),
      getPhaseOutputs(id),
      getFeatureArchive(id),
    ]);

  return (
    <>
    <PollingSubscription />
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Dashboard</Link>
        <span>/</span>
        <span className="text-foreground">{feature.feature_name}</span>
      </div>

      {/* Header */}
      <FeatureHeader feature={feature} healthStatus={eval_?.health_status} />

      {/* Phase Timeline (Enhanced - clickable, expandable) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Phase Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <PhaseTimelineEnhanced
            phases={phases}
            currentPhase={feature.current_phase}
            featureStatus={feature.status}
            invocations={invocations}
            gates={gates}
            blockers={blockers}
            transitions={transitions}
            phaseOutputs={phaseOutputs}
          />
        </CardContent>
      </Card>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Agent Profiler */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Agent Duration Profiler</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentProfiler durations={agents} />
          </CardContent>
        </Card>

        {/* EVAL Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">EVAL Breakdown</CardTitle>
              <RefreshEvalsButton
                action={refreshFeatureEval.bind(null, id)}
                label="Compute"
              />
            </div>
          </CardHeader>
          <CardContent>
            <EvalBreakdown eval_={eval_} />
          </CardContent>
        </Card>
      </div>

      {/* Quality Gates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quality Gates</CardTitle>
        </CardHeader>
        <CardContent>
          <QualityGatesTable gates={gates} />
        </CardContent>
      </Card>

      {/* Blockers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Blockers</CardTitle>
        </CardHeader>
        <CardContent>
          <BlockersTable blockers={blockers} />
        </CardContent>
      </Card>

      {/* Commits & Archives - side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Commits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Commits ({commits.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {commits.length > 0 ? (
              <CommitsTable commits={commits} />
            ) : (
              <p className="text-sm text-muted-foreground">No commits yet</p>
            )}
          </CardContent>
        </Card>

        {/* Archives (only shows content for COMPLETED features) */}
        <ArchivesSection
          featureId={id}
          featureStatus={feature.status}
          archive={archive}
        />
      </div>

      {/* Associated Learnings */}
      {learnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Associated Learnings ({learnings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {learnings.map((l) => (
                <div key={l.id} className="flex items-center gap-3 text-sm">
                  <Badge variant="secondary">{l.category}</Badge>
                  <span className="flex-1 truncate">{l.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatConfidence(l.confidence_score)}
                  </span>
                  {l.is_superseded && (
                    <Badge variant="outline" className="text-xs opacity-50">Superseded</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transition History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Transition History</CardTitle>
        </CardHeader>
        <CardContent>
          <TransitionHistory transitions={transitions} />
        </CardContent>
      </Card>

      {/* Activity Timeline (Audit Log) */}
      {auditLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Activity Timeline ({auditLog.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditTimeline entries={auditLog} />
          </CardContent>
        </Card>
      )}

      {/* Iteration Tracking */}
      {iterations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Iteration Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">#</th>
                    <th className="pb-2 pr-4">Version</th>
                    <th className="pb-2 pr-4">Score</th>
                    <th className="pb-2 pr-4">Issues</th>
                    <th className="pb-2 pr-4">Resolved</th>
                    <th className="pb-2 pr-4">Changes</th>
                    <th className="pb-2">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {iterations.map((it) => (
                    <tr key={it.id} className="border-b border-border/50">
                      <td className="py-2 pr-4">{it.iteration_number}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{it.spec_version}</td>
                      <td className="py-2 pr-4">{it.spec_score?.toFixed(2) ?? '—'}</td>
                      <td className="py-2 pr-4">{it.issues_found}</td>
                      <td className="py-2 pr-4">{it.issues_resolved}</td>
                      <td className="py-2 pr-4">{it.spec_changes_percent}%</td>
                      <td className="py-2 flex gap-1">
                        {it.convergence_detected && <Badge variant="healthy">Converged</Badge>}
                        {it.thrashing_detected && <Badge variant="critical">Thrashing</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </>
  );
}
