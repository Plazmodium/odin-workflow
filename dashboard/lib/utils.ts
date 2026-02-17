/**
 * Odin Dashboard - Utility Functions
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';
import { PHASE_NAMES } from './constants';
import type { Phase, EvalHealth } from './types/database';

/** Merge Tailwind classes with conflict resolution */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Get human-readable phase name from phase number */
export function phaseName(phase: Phase | string): string {
  return PHASE_NAMES[phase] ?? 'Unknown';
}

/** Format milliseconds to human-readable duration */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return '—';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/** Format minutes to human-readable duration */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '—';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  if (hours < 24) return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/** Format a score (0-100) with one decimal */
export function formatScore(score: number | null | undefined): string {
  if (score == null) return '—';
  return score.toFixed(1);
}

/** Format a confidence score (0.00-1.00) as percentage */
export function formatConfidence(score: number | null | undefined): string {
  if (score == null) return '—';
  return `${Math.round(score * 100)}%`;
}

/** Format a timestamp as relative time ("2 hours ago") */
export function formatRelativeTime(timestamp: string | null | undefined): string {
  if (!timestamp) return '—';
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return '—';
  }
}

/** Format a timestamp as absolute date/time */
export function formatDateTime(timestamp: string | null | undefined): string {
  if (!timestamp) return '—';
  try {
    return format(new Date(timestamp), 'MMM d, yyyy HH:mm');
  } catch {
    return '—';
  }
}

/** Format a timestamp as date only */
export function formatDate(timestamp: string | null | undefined): string {
  if (!timestamp) return '—';
  try {
    return format(new Date(timestamp), 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

/** Get health status color class */
export function getHealthColor(status: EvalHealth | null | undefined): string {
  switch (status) {
    case 'HEALTHY': return 'text-healthy';
    case 'CONCERNING': return 'text-concerning';
    case 'CRITICAL': return 'text-critical';
    default: return 'text-zinc-500';
  }
}

/** Get health status background color class */
export function getHealthBgColor(status: EvalHealth | null | undefined): string {
  switch (status) {
    case 'HEALTHY': return 'bg-healthy-muted';
    case 'CONCERNING': return 'bg-concerning-muted';
    case 'CRITICAL': return 'bg-critical-muted';
    default: return 'bg-zinc-500/10';
  }
}

/** Truncate text to a maximum length */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

/** Safe access to JSONB fields with fallback */
export function safeJsonValue<T>(obj: Record<string, unknown> | null | undefined, key: string, fallback: T): T {
  if (obj == null) return fallback;
  const value = obj[key];
  if (value == null) return fallback;
  return value as T;
}

/** Format bytes to human-readable size */
export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
