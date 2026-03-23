import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  History,
  ShieldCheck,
  Target,
} from 'lucide-react';

import { EmptyState } from '@/components/layout/empty-state';
import { PhaseBadge } from '@/components/shared/phase-badge';
import { GateBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, truncate } from '@/lib/utils';
import type {
  DevelopmentEvalCase,
  EvalPlanContent,
  EvalRunContent,
  EvalRunStatus,
  PhaseOutput,
  QualityGate,
} from '@/lib/types/database';

interface DevelopmentEvalsPanelProps {
  phaseOutputs: PhaseOutput[];
  gates: QualityGate[];
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function toEvalCases(value: unknown): DevelopmentEvalCase[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : undefined,
      title: typeof item.title === 'string' ? item.title : undefined,
      prompt: typeof item.prompt === 'string' ? item.prompt : undefined,
      expected_outcome: typeof item.expected_outcome === 'string' ? item.expected_outcome : undefined,
      grader_type: typeof item.grader_type === 'string' ? item.grader_type : undefined,
      pass_rule: typeof item.pass_rule === 'string' ? item.pass_rule : undefined,
      prior_failure: typeof item.prior_failure === 'string' ? item.prior_failure : undefined,
    }));
}

function fallbackSummary(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return truncate(value.trim().replace(/\s+/g, ' '), 220);
  }

  const record = toRecord(value);
  if (record == null) return null;

  const parts = Object.entries(record)
    .slice(0, 4)
    .map(([key, nested]) => {
      if (typeof nested === 'string') {
        return `${key}: ${truncate(nested, 80)}`;
      }
      if (Array.isArray(nested)) {
        return `${key}: ${nested.length} item(s)`;
      }
      return `${key}: structured`;
    });

  return parts.length > 0 ? parts.join(' | ') : null;
}

function parseEvalPlan(content: unknown): EvalPlanContent | null {
  const record = toRecord(content);
  if (record == null) return null;

  return {
    scope: typeof record.scope === 'string' ? record.scope : undefined,
    success_criteria: toStringArray(record.success_criteria),
    non_goals: toStringArray(record.non_goals),
    capability_evals: toEvalCases(record.capability_evals),
    regression_evals: toEvalCases(record.regression_evals),
    transcript_review_plan: toStringArray(record.transcript_review_plan),
    solvability_note: typeof record.solvability_note === 'string' ? record.solvability_note : undefined,
  };
}

function parseEvalRun(content: unknown): EvalRunContent | null {
  const record = toRecord(content);
  if (record == null) return null;

  const status =
    typeof record.status === 'string' && ['passed', 'failed', 'partial', 'blocked'].includes(record.status)
      ? (record.status as EvalRunStatus)
      : undefined;

  return {
    status,
    cases_run: toStringArray(record.cases_run),
    important_failures: toStringArray(record.important_failures),
    manual_review_notes: toStringArray(record.manual_review_notes),
    transcript_review_observations: toStringArray(record.transcript_review_observations),
    follow_up: toStringArray(record.follow_up),
  };
}

function getOutputs(outputs: PhaseOutput[], outputType: 'eval_plan' | 'eval_run'): PhaseOutput[] {
  return outputs
    .filter((output) => output.output_type === outputType)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function getLatestReadinessGate(gates: QualityGate[]): QualityGate | null {
  return gates
    .filter((gate) => gate.gate_name === 'eval_readiness')
    .sort((a, b) => new Date(b.approved_at).getTime() - new Date(a.approved_at).getTime())
    .at(0) ?? null;
}

function caseLabel(evalCase: DevelopmentEvalCase): string {
  return evalCase.id ?? evalCase.title ?? evalCase.expected_outcome ?? evalCase.prompt ?? 'Unnamed case';
}

function statusVariant(status: EvalRunStatus | undefined): 'healthy' | 'critical' | 'concerning' | 'outline' {
  switch (status) {
    case 'passed':
      return 'healthy';
    case 'failed':
    case 'blocked':
      return 'critical';
    case 'partial':
      return 'concerning';
    default:
      return 'outline';
  }
}

function StringListSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-1 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <p key={`${title}-${index}`} className="leading-relaxed">
            {truncate(item, 220)}
          </p>
        ))}
      </div>
    </div>
  );
}

function EvalCaseList({
  title,
  cases,
}: {
  title: string;
  cases: DevelopmentEvalCase[];
}) {
  if (cases.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {cases.map((evalCase, index) => (
          <div key={`${caseLabel(evalCase)}-${index}`} className="rounded-lg border border-border/50 bg-muted/20 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {evalCase.id ? (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {evalCase.id}
                </Badge>
              ) : null}
              {evalCase.grader_type ? <Badge variant="outline">{evalCase.grader_type}</Badge> : null}
            </div>

            <p className="text-sm font-medium leading-relaxed">{truncate(caseLabel(evalCase), 180)}</p>

            {evalCase.expected_outcome ? (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Expected: {truncate(evalCase.expected_outcome, 220)}
              </p>
            ) : null}

            {evalCase.pass_rule ? (
              <p className="mt-1 text-xs text-muted-foreground">Pass rule: {truncate(evalCase.pass_rule, 220)}</p>
            ) : null}

            {evalCase.prior_failure ? (
              <p className="mt-1 text-xs text-critical/90">Prior failure: {truncate(evalCase.prior_failure, 220)}</p>
            ) : null}

            {evalCase.prompt ? (
              <p className="mt-1 text-xs text-muted-foreground">Setup: {truncate(evalCase.prompt, 220)}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DevelopmentEvalsPanel({ phaseOutputs, gates }: DevelopmentEvalsPanelProps) {
  const evalPlans = getOutputs(phaseOutputs, 'eval_plan');
  const evalRuns = getOutputs(phaseOutputs, 'eval_run');
  const latestPlan = evalPlans[0] ?? null;
  const latestRun = evalRuns[0] ?? null;
  const readinessGate = getLatestReadinessGate(gates);

  const plan = latestPlan == null ? null : parseEvalPlan(latestPlan.content);
  const run = latestRun == null ? null : parseEvalRun(latestRun.content);

  if (latestPlan == null && latestRun == null && readinessGate == null) {
    return (
      <EmptyState
        icon={<FlaskConical className="h-6 w-6" />}
        title="No Development Evals yet"
        description="This feature has no recorded eval plan, eval run, or eval readiness gate yet."
        className="py-8"
      />
    );
  }

  const capabilityCases = plan?.capability_evals ?? [];
  const regressionCases = plan?.regression_evals ?? [];
  const failures = run?.important_failures ?? [];
  const reviewNotes = [...(run?.manual_review_notes ?? []), ...(run?.transcript_review_observations ?? [])];
  const planFallback = latestPlan == null ? null : fallbackSummary(latestPlan.content);
  const runFallback = latestRun == null ? null : fallbackSummary(latestRun.content);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {readinessGate ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Eval Readiness</Badge>
            <GateBadge status={readinessGate.status} />
          </div>
        ) : (
          <Badge variant="outline">No eval_readiness gate</Badge>
        )}

        {run?.status ? <Badge variant={statusVariant(run.status)}>Eval Run: {run.status}</Badge> : null}
        {latestPlan ? <Badge variant="outline">Plan: {capabilityCases.length + regressionCases.length} cases</Badge> : null}
        {evalRuns.length > 1 ? <Badge variant="outline">Run History {evalRuns.length}</Badge> : null}
      </div>

      {readinessGate ? (
        <section className="space-y-2 rounded-lg border border-border/60 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Eval Readiness Gate
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <PhaseBadge phase={readinessGate.phase} />
            <span className="text-muted-foreground">{readinessGate.approver}</span>
            <span className="text-muted-foreground">{formatDateTime(readinessGate.approved_at)}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {readinessGate.approval_notes ?? 'No approval notes recorded.'}
          </p>
        </section>
      ) : null}

      {latestPlan ? (
        <section className="space-y-3 rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Latest Eval Plan
            </div>
            <div className="text-xs text-muted-foreground">
              {latestPlan.created_by} · {formatDateTime(latestPlan.created_at)}
            </div>
          </div>

          {plan?.scope ? <p className="text-sm leading-relaxed">{truncate(plan.scope, 220)}</p> : null}
          {!plan?.scope && planFallback ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{planFallback}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">Capability {capabilityCases.length}</Badge>
            <Badge variant="secondary">Regression {regressionCases.length}</Badge>
            {plan?.success_criteria?.length ? (
              <Badge variant="outline">Success Criteria {plan.success_criteria.length}</Badge>
            ) : null}
            {plan?.non_goals?.length ? <Badge variant="outline">Non-Goals {plan.non_goals.length}</Badge> : null}
          </div>

          <StringListSection title="Success Criteria" items={plan?.success_criteria ?? []} />
          <StringListSection title="Non-Goals" items={plan?.non_goals ?? []} />

          <EvalCaseList title="Capability Cases" cases={capabilityCases} />
          <EvalCaseList title="Regression Cases" cases={regressionCases} />

          <StringListSection title="Transcript Review Plan" items={plan?.transcript_review_plan ?? []} />

          {plan?.solvability_note ? (
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Target className="h-3.5 w-3.5" />
                Solvability Note
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{truncate(plan.solvability_note, 240)}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {latestRun ? (
        <section className="space-y-3 rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5" />
              Latest Eval Run
            </div>
            <div className="text-xs text-muted-foreground">
              {latestRun.created_by} · {formatDateTime(latestRun.created_at)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={statusVariant(run?.status)}>{run?.status ?? 'unknown'}</Badge>
            <Badge variant="outline">Cases Run {run?.cases_run?.length ?? 0}</Badge>
            <Badge variant="outline">Failures {failures.length}</Badge>
          </div>

          {!run?.status && runFallback ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{runFallback}</p>
          ) : null}

          {run?.cases_run && run.cases_run.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Cases Run</p>
              <div className="flex flex-wrap gap-1">
                {run.cases_run.map((caseId) => (
                  <Badge key={caseId} variant="secondary" className="font-mono text-[10px]">
                    {caseId}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {failures.length > 0 ? (
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-medium text-critical">
                <AlertTriangle className="h-3 w-3" />
                Important Failures
              </p>
              <div className="space-y-1 text-sm">
                {failures.map((failure, index) => (
                  <div key={`${failure}-${index}`} className="rounded bg-critical/10 px-2 py-1 text-critical/90">
                    {truncate(failure, 180)}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <StringListSection title="Manual Review Notes" items={reviewNotes} />
          <StringListSection title="Follow-Up" items={run?.follow_up ?? []} />

          {evalRuns.length > 1 ? (
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                Eval Run History
              </div>
              <div className="space-y-2">
                {evalRuns.slice(0, 4).map((output) => {
                  const parsed = parseEvalRun(output.content);
                  return (
                    <div key={output.id} className="rounded-lg border border-border/50 bg-muted/20 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(parsed?.status)}>{parsed?.status ?? 'unknown'}</Badge>
                        <PhaseBadge phase={output.phase} />
                        <span className="text-xs text-muted-foreground">{output.created_by}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(output.created_at)}</span>
                      </div>
                      {parsed?.cases_run && parsed.cases_run.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {parsed.cases_run.slice(0, 6).map((caseId) => (
                            <Badge key={`${output.id}-${caseId}`} variant="outline" className="font-mono text-[10px]">
                              {caseId}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {latestPlan == null && latestRun == null && readinessGate ? (
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm text-muted-foreground">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Development Eval Metadata Exists
          </div>
          <p>
            An eval readiness gate is recorded, but no structured `eval_plan` or `eval_run` artifact is available yet.
          </p>
        </div>
      ) : null}
    </div>
  );
}
