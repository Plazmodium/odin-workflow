/**
 * Odin Dashboard - Constants
 * Updated for Odin v2 (11-phase workflow)
 */

import type {
  EvalHealth,
  AlertSeverity,
  GateStatus,
  BlockerSeverity,
  LearningCategory,
  LearningImportance,
  VerificationStatus,
  FindingSeverity,
  RiskLevel,
} from './types/database';

// Phase number → human-readable name (Odin v2: 11 phases)
export const PHASE_NAMES: Record<string, string> = {
  '0': 'Planning',
  '1': 'Product',
  '2': 'Discovery',
  '3': 'Architect',
  '4': 'Guardian',
  '5': 'Builder',
  '6': 'Reviewer',
  '7': 'Integrator',
  '8': 'Documenter',
  '9': 'Release',
  '10': 'Complete',
};

// Health status → Tailwind color classes
export const HEALTH_COLORS: Record<EvalHealth, { text: string; bg: string; border: string; dot: string }> = {
  HEALTHY: { text: 'text-healthy', bg: 'bg-healthy-muted', border: 'border-healthy', dot: 'bg-healthy' },
  CONCERNING: { text: 'text-concerning', bg: 'bg-concerning-muted', border: 'border-concerning', dot: 'bg-concerning' },
  CRITICAL: { text: 'text-critical', bg: 'bg-critical-muted', border: 'border-critical', dot: 'bg-critical' },
};

// Alert severity colors
export const ALERT_COLORS: Record<AlertSeverity, { text: string; bg: string }> = {
  WARNING: { text: 'text-concerning', bg: 'bg-concerning-muted' },
  CRITICAL: { text: 'text-critical', bg: 'bg-critical-muted' },
};

// Gate status colors
export const GATE_COLORS: Record<GateStatus, { text: string; bg: string }> = {
  PENDING: { text: 'text-concerning', bg: 'bg-concerning-muted' },
  APPROVED: { text: 'text-healthy', bg: 'bg-healthy-muted' },
  REJECTED: { text: 'text-critical', bg: 'bg-critical-muted' },
};

// Blocker severity colors
export const BLOCKER_SEVERITY_COLORS: Record<BlockerSeverity, { text: string; bg: string }> = {
  LOW: { text: 'text-zinc-400', bg: 'bg-zinc-400/10' },
  MEDIUM: { text: 'text-concerning', bg: 'bg-concerning-muted' },
  HIGH: { text: 'text-orange-500', bg: 'bg-orange-500/10' },
  CRITICAL: { text: 'text-critical', bg: 'bg-critical-muted' },
};

// Learning category colors for graph nodes
export const CATEGORY_COLORS: Record<LearningCategory, string> = {
  DECISION: '#3b82f6',
  PATTERN: '#8b5cf6',
  GOTCHA: '#ef4444',
  CONVENTION: '#22c55e',
  ARCHITECTURE: '#f59e0b',
  RATIONALE: '#06b6d4',
  OPTIMIZATION: '#ec4899',
  INTEGRATION: '#14b8a6',
};

// Learning importance badge variants
export const IMPORTANCE_COLORS: Record<LearningImportance, { text: string; bg: string }> = {
  HIGH: { text: 'text-critical', bg: 'bg-critical-muted' },
  MEDIUM: { text: 'text-concerning', bg: 'bg-concerning-muted' },
  LOW: { text: 'text-zinc-400', bg: 'bg-zinc-400/10' },
};

// Recharts color palette for agent profiler
export const AGENT_CHART_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#14b8a6', // teal
];

// ============================================================
// Odin v2: Watcher & Security Constants
// ============================================================

// Verification status colors (for claims/watcher)
export const VERIFICATION_STATUS_COLORS: Record<VerificationStatus, { text: string; bg: string; icon: string }> = {
  PENDING: { text: 'text-zinc-400', bg: 'bg-zinc-400/10', icon: '⏳' },
  PASS: { text: 'text-healthy', bg: 'bg-healthy-muted', icon: '✓' },
  FAIL: { text: 'text-critical', bg: 'bg-critical-muted', icon: '✗' },
  NEEDS_REVIEW: { text: 'text-concerning', bg: 'bg-concerning-muted', icon: '👁' },
};

// Finding severity colors (for security findings)
export const FINDING_SEVERITY_COLORS: Record<FindingSeverity, { text: string; bg: string; border: string }> = {
  INFO: { text: 'text-zinc-400', bg: 'bg-zinc-400/10', border: 'border-zinc-400' },
  LOW: { text: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400' },
  MEDIUM: { text: 'text-concerning', bg: 'bg-concerning-muted', border: 'border-concerning' },
  HIGH: { text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500' },
  CRITICAL: { text: 'text-critical', bg: 'bg-critical-muted', border: 'border-critical' },
};

// Risk level colors (for claims)
export const RISK_LEVEL_COLORS: Record<RiskLevel, { text: string; bg: string }> = {
  LOW: { text: 'text-zinc-400', bg: 'bg-zinc-400/10' },
  MEDIUM: { text: 'text-concerning', bg: 'bg-concerning-muted' },
  HIGH: { text: 'text-critical', bg: 'bg-critical-muted' },
};

// Watched phases (phases that emit claims and are subject to watcher verification)
export const WATCHED_PHASES = ['5', '7', '9'] as const; // Builder, Integrator, Release
