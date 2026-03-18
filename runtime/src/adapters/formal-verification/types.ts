/**
 * Formal Verification Adapter Types
 * Version: 0.1.0
 */

export type VerificationStatus =
  | 'VERIFIED'
  | 'VIOLATION'
  | 'INVALID_MODEL'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'NOT_CONFIGURED'
  | 'INTERNAL_ERROR';

export interface InvariantViolation {
  invariant_name: string;
  description: string;
  counter_example_summary?: string;
  trace_path?: string;
}

export interface MachineVerificationResult {
  machine_name: string;
  status: VerificationStatus;
  proof_passed: boolean;
  equivalent: boolean | null;
  states_checked: number;
  invariant_violations: InvariantViolation[];
  error?: string;
  duration_ms: number;
}

export interface DesignVerificationResult {
  feature_id: string;
  overall_status: VerificationStatus;
  machines: MachineVerificationResult[];
  total_states_checked: number;
  total_duration_ms: number;
}

export interface VerifyDesignRequest {
  feature_id: string;
  machine_path: string;
}

export interface FormalVerificationAdapter {
  verifyDesign(request: VerifyDesignRequest): Promise<MachineVerificationResult>;
  isAvailable(): Promise<boolean>;
}
