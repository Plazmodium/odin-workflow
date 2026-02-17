/**
 * Odin Dashboard - Constants
 */

import type { EvalHealth, AlertSeverity, GateStatus, BlockerSeverity, LearningCategory, LearningImportance } from './types/database';

// Phase number → human-readable name
export const PHASE_NAMES: Record<string, string> = {
  '0': 'Planning',
  '1': 'Discovery',
  '2': 'Architect',
  '3': 'Guardian',
  '4': 'Builder',
  '5': 'Integrator',
  '6': 'Documenter',
  '7': 'Release',
  '8': 'Complete',
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
