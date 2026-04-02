export type PhaseId = string;

export type SupervisorEventType = 'tick_started' | 'tick_selected' | 'tick_noop' | 'tick_failed' | 'tick_completed';

export interface AutonomousSelection {
  feature_id: string;
  feature_name: string;
  phase: PhaseId;
  reason: string | null;
  branch_name: string | null;
  base_branch: string | null;
  release_notes: string | null;
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
  outcome: 'completed';
  next_phase: PhaseId;
  summary: string;
  created_by: string;
  blockers: string[];
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
}

export interface TickOutcome {
  outcome: 'noop' | 'completed' | 'failed';
  summary: string;
  selection: AutonomousSelection | null;
}
