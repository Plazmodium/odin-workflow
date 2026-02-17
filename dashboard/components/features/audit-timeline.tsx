/**
 * AuditTimeline
 *
 * Displays a chronological timeline of audit log entries for a feature or system-wide.
 */

import {
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  GitCommit,
  GitPullRequest,
  Brain,
  ArrowUpCircle,
  Activity,
  Rocket,
  Flag,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils';
import { EmptyState } from '@/components/layout/empty-state';
import type { AuditLogEntry } from '@/lib/types/database';

interface AuditTimelineProps {
  entries: AuditLogEntry[];
  showFeatureLink?: boolean;
}

const OPERATION_CONFIG: Record<
  string,
  { icon: typeof Activity; color: string; label: string }
> = {
  FEATURE_CREATED: {
    icon: Rocket,
    color: 'text-blue-400',
    label: 'Feature Created',
  },
  FEATURE_COMPLETED: {
    icon: Flag,
    color: 'text-emerald-400',
    label: 'Feature Completed',
  },
  PHASE_TRANSITION: {
    icon: Zap,
    color: 'text-amber-400',
    label: 'Phase Transition',
  },
  BLOCKER_CREATED: {
    icon: AlertTriangle,
    color: 'text-red-400',
    label: 'Blocker Created',
  },
  BLOCKER_RESOLVED: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    label: 'Blocker Resolved',
  },
  GATE_APPROVED: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    label: 'Gate Approved',
  },
  GATE_REJECTED: {
    icon: XCircle,
    color: 'text-red-400',
    label: 'Gate Rejected',
  },
  COMMIT_RECORDED: {
    icon: GitCommit,
    color: 'text-zinc-400',
    label: 'Commit Recorded',
  },
  PR_CREATED: {
    icon: GitPullRequest,
    color: 'text-purple-400',
    label: 'PR Created',
  },
  LEARNING_CREATED: {
    icon: Brain,
    color: 'text-violet-400',
    label: 'Learning Created',
  },
  SKILL_PROPAGATION: {
    icon: ArrowUpCircle,
    color: 'text-cyan-400',
    label: 'Propagation Recorded',
  },
  PROPAGATION_RECORDED: {
    icon: ArrowUpCircle,
    color: 'text-cyan-400',
    label: 'Propagation Recorded',
  },
  SKILLS_LOADED: {
    icon: BookOpen,
    color: 'text-indigo-400',
    label: 'Skills Loaded',
  },
};

function getOperationConfig(operation: string) {
  return (
    OPERATION_CONFIG[operation] ?? {
      icon: Activity,
      color: 'text-muted-foreground',
      label: operation.replace(/_/g, ' '),
    }
  );
}

function formatDetails(
  operation: string,
  details: Record<string, unknown> | null
): string | null {
  if (!details) return null;

  switch (operation) {
    case 'PHASE_TRANSITION': {
      const from = details.from_phase as string | undefined;
      const to = details.to_phase as string | undefined;
      if (from != null && to != null) return `Phase ${from} → Phase ${to}`;
      return null;
    }
    case 'FEATURE_CREATED': {
      const complexity = details.complexity_level as number | undefined;
      const severity = details.severity as string | undefined;
      const parts: string[] = [];
      if (complexity != null) parts.push(`L${complexity}`);
      if (severity) parts.push(severity);
      return parts.length > 0 ? parts.join(', ') : null;
    }
    case 'GATE_APPROVED':
    case 'GATE_REJECTED': {
      const gate = details.gate_name as string | undefined;
      return gate ?? null;
    }
    case 'COMMIT_RECORDED': {
      const msg = details.message as string | undefined;
      const hash = details.commit_hash as string | undefined;
      if (msg) return msg;
      if (hash) return hash.slice(0, 7);
      return null;
    }
    case 'PR_CREATED': {
      const prNum = details.pr_number as number | undefined;
      return prNum != null ? `PR #${prNum}` : null;
    }
    case 'BLOCKER_CREATED': {
      const title = details.title as string | undefined;
      return title ?? null;
    }
    case 'SKILL_PROPAGATION':
    case 'PROPAGATION_RECORDED': {
      const target = details.target_type as string | undefined;
      const path = details.target_path as string | undefined;
      if (target && path) return `${target}: ${path}`;
      if (target) return target;
      return null;
    }
    case 'SKILLS_LOADED': {
      const skills = details.skills as string[] | undefined;
      if (skills && skills.length > 0) return skills.join(', ');
      return null;
    }
    default:
      return null;
  }
}

export function AuditTimeline({
  entries,
  showFeatureLink = false,
}: AuditTimelineProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="h-8 w-8" />}
        title="No activity"
        description="No audit log entries found."
      />
    );
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, index) => {
        const config = getOperationConfig(entry.operation);
        const Icon = config.icon;
        const detail = formatDetails(entry.operation, entry.details);
        const isLast = index === entries.length - 1;

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline line + icon */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface border border-border ${config.color}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-border" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{config.label}</span>
                {showFeatureLink && entry.feature_id && (
                  <Link
                    href={`/features/${entry.feature_id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    {entry.feature_id}
                  </Link>
                )}
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {formatRelativeTime(entry.timestamp)}
                </span>
              </div>
              {detail && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {detail}
                </p>
              )}
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                by {entry.agent_name}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
