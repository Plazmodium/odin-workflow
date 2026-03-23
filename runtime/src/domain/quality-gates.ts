/**
 * Quality Gate Helpers
 * Version: 0.1.0
 */

import type { QualityGateRecord } from '../types.js';

export function formatOpenGateSummary(gate: QualityGateRecord): string {
  return `${gate.gate_name} [phase ${gate.phase}] (${gate.status})`;
}
