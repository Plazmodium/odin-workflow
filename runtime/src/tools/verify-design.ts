/**
 * Verify Design Tool
 * Version: 0.1.0
 */

import type { FormalVerificationAdapter } from '../adapters/formal-verification/types.js';
import type { VerifyDesignInput } from '../schemas.js';
import { createTextResult } from '../utils.js';

export async function handleVerifyDesign(
  adapter: FormalVerificationAdapter | null,
  input: VerifyDesignInput
) {
  if (adapter == null) {
    return createTextResult(
      'Formal verification is not configured. Set `formal_verification.provider: tla-precheck` in `.odin/config.yaml`.',
      {
        status: 'NOT_CONFIGURED',
        error: 'Formal verification is not configured. Set `formal_verification.provider: tla-precheck` in `.odin/config.yaml`.',
      }
    );
  }

  const available = await adapter.isAvailable();
  if (!available) {
    return createTextResult(
      'tla-precheck is not available. Ensure Java 17+ is installed and tla-precheck is in project dependencies: npm install -D tla-precheck@<version>',
      {
        status: 'UNAVAILABLE',
        error: 'tla-precheck not found in project dependencies or Java 17+ not installed. Run: npm install -D tla-precheck@<version>',
      }
    );
  }

  const result = await adapter.verifyDesign({
    feature_id: input.feature_id,
    machine_path: input.machine_path,
  });

  const status_text = result.status === 'VERIFIED'
    ? `Design verification PASSED for ${result.machine_name}. ${result.states_checked} states checked in ${result.duration_ms}ms.`
    : result.status === 'VIOLATION'
      ? `Design verification FAILED for ${result.machine_name}. ${result.invariant_violations.length} violation(s) found.`
      : `Design verification returned ${result.status} for ${result.machine_name}.${result.error ? ` ${result.error}` : ''}`;

  return createTextResult(status_text, { ...result });
}
