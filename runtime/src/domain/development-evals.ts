/**
 * Development Eval Workflow Helpers
 * Version: 0.1.0
 */

import type {
  DevelopmentEvalMode,
  FeatureRecord,
  PhaseArtifact,
  PhaseContextBundle,
  PhaseId,
  QualityGateRecord,
} from '../types.js';

const NON_INTERFERENCE_RULES: string[] = [
  'Development evals are additive and never replace formal verification, tests, security review, runtime verification, or watcher checks.',
  'A passing eval result does not override a failing Semgrep/security outcome.',
  'A passing eval result does not override build, runtime, or claim-verification failures.',
];

function getLatestArtifact(artifacts: PhaseArtifact[], output_type: 'eval_plan' | 'eval_run'): PhaseArtifact | null {
  return artifacts.filter((artifact) => artifact.output_type === output_type).at(-1) ?? null;
}

function getPhaseSpecificRequirements(mode: DevelopmentEvalMode, phase: PhaseId): string[] {
  switch (phase) {
    case '1':
      return ['Capture success criteria, non-goals, and failure shape for downstream eval planning.'];
    case '2':
      return ['Capture happy-path, edge, failure, and should-not-trigger scenarios for downstream eval planning.'];
    case '3':
      return mode === 'plan_required'
        ? ['Record an eval_plan artifact with capability and regression cases before build.']
        : ['Define the minimal acceptance/regression case that must exist before Builder completes.'];
    case '4':
      return mode === 'plan_required'
        ? ['Decide the eval_readiness gate before Builder starts.']
        : ['Verify the minimal L1 development eval obligation is concrete before Builder proceeds.'];
    case '5':
      return mode === 'plan_required'
        ? ['Implement against the eval_plan; eval coverage does not replace real tests.']
        : ['Before Builder completes, ensure at least one minimal acceptance or regression case exists.'];
    case '6':
      return ['Record an eval_run artifact; failing development evals do not override security-review blockers.'];
    case '7':
      return ['Resolve any partial eval state with observable runtime or end-state verification.'];
    case '9':
      return ['Archive the relevant eval summary when present.'];
    default:
      return [];
  }
}

function getExpectedArtifacts(
  mode: DevelopmentEvalMode,
  phase: PhaseId,
  latest_run: PhaseArtifact | null
): Array<'eval_plan' | 'eval_run'> {
  switch (phase) {
    case '3':
      return mode === 'plan_required' ? ['eval_plan'] : [];
    case '6':
      return ['eval_run'];
    case '7':
      return getEvalRunStatus(latest_run) === 'partial' ? ['eval_run'] : [];
    default:
      return [];
  }
}

function getExpectedGate(mode: DevelopmentEvalMode, phase: PhaseId): 'eval_readiness' | null {
  return phase === '4' && mode === 'plan_required' ? 'eval_readiness' : null;
}

function toPhaseNumber(phase: PhaseId): number {
  return Number.parseInt(phase, 10);
}

function getLatestOpenReadinessGate(open_gate_records: QualityGateRecord[]): QualityGateRecord | null {
  return open_gate_records
    .filter((gate) => gate.gate_name === 'eval_readiness')
    .sort((left, right) => {
      const timestamp_delta = new Date(right.approved_at).getTime() - new Date(left.approved_at).getTime();
      if (timestamp_delta !== 0) {
        return timestamp_delta;
      }

      return toPhaseNumber(right.phase) - toPhaseNumber(left.phase);
    })
    .at(0) ?? null;
}

function getEvalRunStatus(latest_run: PhaseArtifact | null): string | null {
  if (latest_run == null || latest_run.content == null || typeof latest_run.content !== 'object') {
    return null;
  }

  const status = (latest_run.content as Record<string, unknown>).status;
  return typeof status === 'string' ? status : null;
}

function buildStatusSummary(
  mode: DevelopmentEvalMode,
  phase: PhaseId,
  latest_plan: PhaseArtifact | null,
  latest_run: PhaseArtifact | null,
  open_readiness_gate: QualityGateRecord | null
): string[] {
  const summary: string[] = [];
  const phase_number = toPhaseNumber(phase);

  if (mode === 'plan_required' && phase_number >= 3 && latest_plan == null) {
    summary.push('No eval_plan artifact has been recorded yet.');
  }

  if (latest_plan != null) {
    summary.push(`Latest eval_plan recorded by ${latest_plan.created_by} at ${latest_plan.created_at}.`);
  }

  const latest_run_status = getEvalRunStatus(latest_run);
  if (phase_number >= 6 && latest_run == null) {
    summary.push('No eval_run artifact has been recorded yet.');
  } else if (latest_run != null) {
    summary.push(
      latest_run_status == null
        ? `Latest eval_run recorded by ${latest_run.created_by} at ${latest_run.created_at}.`
        : `Latest eval_run status is ${latest_run_status}.`
    );
  }

  if (phase === '7' && latest_run_status === 'partial') {
    summary.push('Integrator must resolve the partial eval_run before Release.');
  }

  if (open_readiness_gate != null) {
    summary.push(`Open eval_readiness gate is ${open_readiness_gate.status} in phase ${open_readiness_gate.phase}.`);
  }

  return summary;
}

function buildHarnessPromptBlock(
  mode: DevelopmentEvalMode,
  phase: PhaseId,
  latest_plan: PhaseArtifact | null,
  latest_run: PhaseArtifact | null,
  open_readiness_gate: QualityGateRecord | null
): string[] {
  const lines: string[] = [];

  if (phase === '3' && mode === 'plan_required') {
    lines.push('Development Evals are required: produce an `eval_plan` artifact with capability and regression cases before handoff.');
  }

  if (phase === '4' && mode === 'plan_required') {
    lines.push('Development Evals are required: decide the `eval_readiness` gate explicitly before Builder starts.');
    lines.push('Reject eval plans that are ambiguous, path-rigid, or missing regression coverage for bug fixes.');
  }

  if (phase === '5') {
    lines.push(
      latest_plan == null && mode === 'plan_required'
        ? 'Development Evals are required: no `eval_plan` is visible, so block and escalate instead of guessing.'
        : open_readiness_gate != null
          ? `Development Evals are required: the open \`eval_readiness\` gate is ${open_readiness_gate.status}. Respect that gate and escalate instead of bypassing it.`
          : 'Development Evals guide implementation, but they do not replace real tests, build checks, or other review steps.'
    );
  }

  if (phase === '6') {
    lines.push('Development Evals are required here: record an `eval_run` artifact after review-time execution.');
    lines.push('A passing `eval_run` never overrides failing security findings.');
  }

  if (phase === '7') {
    lines.push(
      getEvalRunStatus(latest_run) === 'partial'
        ? 'The latest `eval_run` is partial: resolve it with runtime/end-state evidence and record an updated `eval_run`.'
        : 'If runtime verification materially changes development-eval confidence, record an updated `eval_run`.'
    );
  }

  if (lines.length > 0) {
    lines.push('Development Evals are additive only; they never replace formal verification, Semgrep, tests, runtime verification, or watcher checks.');
  }

  return lines;
}

export function getDevelopmentEvalMode(feature: FeatureRecord): DevelopmentEvalMode {
  return feature.complexity_level === 1 ? 'l1_minimal' : 'plan_required';
}

export function buildDevelopmentEvalContext(
  feature: FeatureRecord,
  phase: PhaseId,
  artifacts: PhaseArtifact[],
  open_gate_records: QualityGateRecord[]
): PhaseContextBundle['development_evals'] {
  const mode = getDevelopmentEvalMode(feature);
  const latest_plan = getLatestArtifact(artifacts, 'eval_plan');
  const latest_run = getLatestArtifact(artifacts, 'eval_run');
  const open_readiness_gate = getLatestOpenReadinessGate(open_gate_records);

  return {
    mode,
    latest_plan,
    latest_run,
    expected_artifacts: getExpectedArtifacts(mode, phase, latest_run),
    expected_gate: getExpectedGate(mode, phase),
    open_readiness_gate,
    requirements: getPhaseSpecificRequirements(mode, phase),
    status_summary: buildStatusSummary(mode, phase, latest_plan, latest_run, open_readiness_gate),
    harness_prompt_block: buildHarnessPromptBlock(mode, phase, latest_plan, latest_run, open_readiness_gate),
    non_interference_rules: NON_INTERFERENCE_RULES,
  };
}

export function appendDevelopmentEvalChecks(
  base_checks: string[],
  phase: PhaseId
): string[] {
  if (phase === '6') {
    return [...base_checks, 'development eval review'];
  }

  if (phase === '7') {
    return [...base_checks, 'development eval runtime resolution'];
  }

  return base_checks;
}
