export type PhaseId = string;

export const PHASE_IDS = new Set<PhaseId>(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

export type PhaseExecutionMode = 'inline' | 'subagent';

export type PhaseResponseStyle = 'normal' | 'terse_execution';

export type PhaseChildStateStrategy = 'direct_odin_tools_if_available' | 'return_intent_to_parent';

export type PhasePromptSection =
  | 'phase'
  | 'role_summary'
  | 'constraints'
  | 'development_evals'
  | 'automation'
  | 'verification'
  | 'workflow'
  | 'artifacts'
  | 'skills'
  | 'learnings';

export type PhaseOutcome = 'completed' | 'blocked' | 'needs_rework';

export type SupervisorEventType = 'tick_started' | 'tick_selected' | 'tick_noop' | 'tick_failed' | 'tick_completed';

export interface AutonomousSelection {
  feature_id: string;
  feature_name: string;
  phase: PhaseId;
  reason: string | null;
  branch_name: string | null;
  base_branch: string | null;
  release_notes: string | null;
  prepared_context: PreparedPhaseContext;
}

export interface PreparedPhaseContext {
  raw: Record<string, unknown>;
  phase: {
    id: PhaseId;
    name: string;
    purpose: string | null;
    definition_of_done: string[];
  };
  agent: {
    name: string;
    role_summary: string;
    constraints: string[];
  };
  execution: {
    phase_role_name: string;
    acting_agent_name: string;
    supported_modes: PhaseExecutionMode[];
    recommended_mode: PhaseExecutionMode;
    child_state_strategy: PhaseChildStateStrategy;
    response_style: PhaseResponseStyle;
    prompt_sections: PhasePromptSection[];
  };
}

export interface SkippedSummaryItem {
  feature_id: string;
  feature_name: string;
  current_phase: PhaseId;
  status: string;
  detail: string;
}

export interface PickNextAutonomousPhaseResult {
  selection: AutonomousSelection | null;
  skipped_summary: SkippedSummaryItem[];
}

export interface PickNextAutonomousPhaseOptions {
  allowed_selection_reasons?: string[];
  allowed_phases?: PhaseId[];
}

export interface RecordSupervisorEventInput {
  supervisor_name: string;
  event_type: SupervisorEventType;
  summary: string;
  feature_id?: string | null;
  phase?: PhaseId;
  details?: Record<string, unknown>;
}

export interface RecordPhaseResultInput {
  feature_id: string;
  phase: PhaseId;
  outcome: PhaseOutcome;
  next_phase?: PhaseId;
  summary: string;
  created_by: string;
  blockers: string[];
}

export interface RecordPhaseArtifactInput {
  feature_id: string;
  phase: PhaseId;
  output_type: string;
  content: unknown;
  created_by: string;
}

export interface RecordPullRequestInput {
  feature_id: string;
  pr_url: string;
  pr_number: number;
}

export interface ArchiveFeatureReleaseInput {
  feature_id: string;
  summary: string;
  archived_by: string;
  release_notes?: string;
}

export interface RecordReleaseHandoffInput {
  feature_id: string;
  summary: string;
  created_by: string;
}

export interface RecordReleaseHandoffFailureInput {
  feature_id: string;
  summary: string;
  created_by: string;
}

export interface RecordReleaseCloseoutFailureInput {
  feature_id: string;
  summary: string;
  created_by: string;
}

export interface RuntimeToolClient {
  pickNextAutonomousPhase(supervisor_name: string, options?: PickNextAutonomousPhaseOptions): Promise<PickNextAutonomousPhaseResult>;
  recordSupervisorEvent(input: RecordSupervisorEventInput): Promise<void>;
  recordPhaseArtifact(input: RecordPhaseArtifactInput): Promise<void>;
  recordPhaseResult(input: RecordPhaseResultInput): Promise<void>;
  archiveFeatureRelease(input: ArchiveFeatureReleaseInput): Promise<void>;
  recordPullRequest(input: RecordPullRequestInput): Promise<void>;
  recordReleaseHandoff(input: RecordReleaseHandoffInput): Promise<void>;
  recordReleaseHandoffFailure(input: RecordReleaseHandoffFailureInput): Promise<void>;
  recordReleaseCloseoutFailure(input: RecordReleaseCloseoutFailureInput): Promise<void>;
  close(): Promise<void>;
}

export interface RalphLoopConfig {
  project_root: string;
  supervisor_name: string;
  interval_ms: number;
  subagent_command: string[] | null;
}

export interface SubagentExecutionArtifact {
  phase?: PhaseId;
  output_type: string;
  content: unknown;
}

export interface SubagentExecutionRequest {
  project_root: string;
  supervisor_name: string;
  selection: AutonomousSelection;
  prompt: string;
}

export interface SubagentExecutionResult {
  summary: string;
  outcome: PhaseOutcome;
  next_phase?: PhaseId;
  blockers?: string[];
  artifacts?: SubagentExecutionArtifact[];
}

export interface SubagentExecutor {
  execute(request: SubagentExecutionRequest): Promise<SubagentExecutionResult>;
}

export interface TickOutcome {
  outcome: 'noop' | 'completed' | 'blocked' | 'needs_rework' | 'failed';
  summary: string;
  selection: AutonomousSelection | null;
}
