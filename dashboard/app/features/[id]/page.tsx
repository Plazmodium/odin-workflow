export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import {
  getFeatureStatus,
  getFeatureCommits,
  getPhaseDurations,
  getAgentDurations,
  getAgentInvocations,
  getPhaseExecutionAttestations,
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
import { getFeatureClaimsWithVerification, getClaimsSummary } from '@/lib/data/claims';
import { getSecurityFindings, getSecuritySummary } from '@/lib/data/security';
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
import { WatcherVerificationPanel } from '@/components/features/watcher-verification-panel';
import { SecurityFindingsPanel } from '@/components/features/security-findings-panel';
import { DevelopmentEvalsPanel } from '@/components/features/development-evals-panel';
import { RefreshEvalsButton } from '@/components/shared/refresh-evals-button';
import { PollingSubscription } from '@/components/realtime/realtime-page';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatConfidence } from '@/lib/utils';
import Link from 'next/link';

const EXECUTION_POLICY_BY_PHASE = {
  '0': 'inline_allowed',
  '1': 'inline_allowed',
  '2': 'inline_allowed',
  '3': 'inline_allowed',
  '4': 'inline_allowed',
  '5': 'distinct_session_preferred',
  '6': 'distinct_session_preferred',
  '7': 'distinct_session_preferred',
  '8': 'inline_allowed',
  '9': 'inline_allowed',
  '10': 'inline_allowed',
} as const;

const RECOMMENDED_MODE_BY_PHASE = {
  '0': 'inline',
  '1': 'inline',
  '2': 'inline',
  '3': 'inline',
  '4': 'inline',
  '5': 'subagent',
  '6': 'subagent',
  '7': 'subagent',
  '8': 'subagent',
  '9': 'inline',
  '10': 'inline',
} as const;

interface FeatureDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function FeatureDetailPage({ params }: FeatureDetailPageProps) {
  const { id } = await params;

  const feature = await getFeatureStatus(id);
  if (!feature) notFound();

  const [phases, agentDurationsResult, invocations, executionAttestationsResult, gates, blockers, eval_, learnings, transitions, iterations, commits, auditLog, phaseOutputs, archive, claims, claimsSummary, securityFindings, securitySummary] =
    await Promise.all([
      getPhaseDurations(id),
      getAgentDurations(id),
      getAgentInvocations(id),
      getPhaseExecutionAttestations(id),
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
      getFeatureClaimsWithVerification(id),
      getClaimsSummary(id),
      getSecurityFindings(id),
      getSecuritySummary(id),
    ]);
  const executionAttestations = executionAttestationsResult.attestations;
  const currentPhasePolicy = EXECUTION_POLICY_BY_PHASE[feature.current_phase];
  const currentPhaseRecommendedMode = RECOMMENDED_MODE_BY_PHASE[feature.current_phase];
  const currentPhaseAttestation = executionAttestations.find((attestation) => attestation.phase === feature.current_phase) ?? null;
  const currentPhaseWarning =
    currentPhasePolicy === 'inline_allowed'
      ? null
      : currentPhaseAttestation == null
        ? `No execution attestation recorded for current phase ${feature.current_phase}.`
        : currentPhaseAttestation.actual_mode !== 'subagent' ||
            currentPhaseAttestation.worker_session_id == null ||
            currentPhaseAttestation.supervisor_session_id == null ||
            currentPhaseAttestation.worker_session_id === currentPhaseAttestation.supervisor_session_id
          ? `Current phase ${feature.current_phase} prefers a distinct worker session, but the recorded attestation does not prove one.`
          : null;

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
            <CardDescription>
              Elapsed phase windows, including waiting, handoff, and review time.
            </CardDescription>
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
            <CardTitle className="text-sm">Agent Runtime Profiler</CardTitle>
            <CardDescription>
              Completed agent invocation runtime only; excludes idle time inside a phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AgentProfiler durations={agentDurationsResult.durations} error={agentDurationsResult.error} claimsSummary={claimsSummary} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Phase Execution</CardTitle>
            <CardDescription>
              Expected policy vs attested execution mode for the current phase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Policy: {currentPhasePolicy}</Badge>
              <Badge variant="outline">Recommended: {currentPhaseRecommendedMode}</Badge>
              <Badge variant={currentPhaseAttestation == null ? 'outline' : 'secondary'}>
                Actual: {currentPhaseAttestation?.actual_mode ?? 'not recorded'}
              </Badge>
              <Badge variant={currentPhaseAttestation?.proof_status === 'attested' || currentPhaseAttestation?.proof_status === 'verified' ? 'secondary' : 'outline'}>
                Proof: {currentPhaseAttestation?.proof_status ?? 'none'}
              </Badge>
            </div>
            {currentPhaseAttestation != null && (
              <div className="space-y-1 text-muted-foreground">
                <p>Supervisor session: {currentPhaseAttestation.supervisor_session_id ?? 'n/a'}</p>
                <p>Worker session: {currentPhaseAttestation.worker_session_id ?? 'n/a'}</p>
                <p>Attested by: {currentPhaseAttestation.attested_by ?? 'n/a'}</p>
              </div>
            )}
            {currentPhaseWarning != null && (
              <p className="text-amber-600 dark:text-amber-400">{currentPhaseWarning}</p>
            )}
            {executionAttestationsResult.error != null && (
              <p className="text-amber-600 dark:text-amber-400">{executionAttestationsResult.error}</p>
            )}
            {executionAttestations.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recorded attestations</p>
                <div className="space-y-2">
                  {executionAttestations.map((attestation) => (
                    <div key={`${attestation.feature_id}:${attestation.phase}`} className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">Phase {attestation.phase}</Badge>
                      <span>{attestation.actual_mode}</span>
                      <span className="text-muted-foreground">proof: {attestation.proof_status}</span>
                      <span className="text-muted-foreground">by {attestation.attested_by ?? 'n/a'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Development Evals</CardTitle>
          </CardHeader>
          <CardContent>
            <DevelopmentEvalsPanel phaseOutputs={phaseOutputs} gates={gates} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quality Gates</CardTitle>
          </CardHeader>
          <CardContent>
            <QualityGatesTable gates={gates} featureStatus={feature.status} />
          </CardContent>
        </Card>
      </div>

      {/* Blockers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Blockers</CardTitle>
        </CardHeader>
        <CardContent>
          <BlockersTable blockers={blockers} />
        </CardContent>
      </Card>

      {/* Watcher Verification & Security Findings - side by side (Odin v2) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Watcher Verification Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Watcher Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <WatcherVerificationPanel claims={claims} summary={claimsSummary} />
          </CardContent>
        </Card>

        {/* Security Findings Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Security Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <SecurityFindingsPanel findings={securityFindings} summary={securitySummary} />
          </CardContent>
        </Card>
      </div>

      {/* Commits & Release - side by side */}
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

        {/* Release handoff, merge, and archive status */}
        <ArchivesSection
          featureId={id}
          feature={feature}
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
