'use client';

/**
 * FeaturesListView
 *
 * Client component with full filtering, sorting, and search for features.
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, GitBranch, ExternalLink, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PHASE_NAMES, HEALTH_COLORS } from '@/lib/constants';
import { formatRelativeTime, formatDuration } from '@/lib/utils';
import { EmptyState } from '@/components/layout/empty-state';
import type { AllFeatureSummary, FeatureStatus, Severity, EvalHealth } from '@/lib/types/database';

type SortField = 'feature_id' | 'feature_name' | 'feature_status' | 'current_phase' | 'complexity_level' | 'overall_score' | 'total_duration_ms' | 'created_at';
type SortDir = 'asc' | 'desc';
type GitStatusFilter = 'ALL' | 'no_branch' | 'has_branch' | 'has_pr' | 'merged';

interface FeaturesListViewProps {
  features: AllFeatureSummary[];
}

function getGitStatus(f: AllFeatureSummary): GitStatusFilter {
  if (f.merged_at) return 'merged';
  if (f.pr_url) return 'has_pr';
  if (f.branch_name) return 'has_branch';
  return 'no_branch';
}

const STATUS_ORDER: Record<FeatureStatus, number> = {
  IN_PROGRESS: 0,
  BLOCKED: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

const STATUS_COLORS: Record<FeatureStatus, string> = {
  IN_PROGRESS: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  BLOCKED: 'bg-red-500/10 text-red-400 border-red-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

export function FeaturesListView({ features }: FeaturesListViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeatureStatus | 'ALL'>('ALL');
  const [complexityFilter, setComplexityFilter] = useState<1 | 2 | 3 | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const [gitFilter, setGitFilter] = useState<GitStatusFilter | 'ALL'>('ALL');
  const [healthFilter, setHealthFilter] = useState<EvalHealth | 'no_eval' | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    let result = features;

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.feature_id.toLowerCase().includes(q) ||
          f.feature_name.toLowerCase().includes(q) ||
          (f.author && f.author.toLowerCase().includes(q))
      );
    }

    // Filters
    if (statusFilter !== 'ALL') {
      result = result.filter((f) => f.feature_status === statusFilter);
    }
    if (complexityFilter !== 'ALL') {
      result = result.filter((f) => f.complexity_level === complexityFilter);
    }
    if (severityFilter !== 'ALL') {
      result = result.filter((f) => f.severity === severityFilter);
    }
    if (gitFilter !== 'ALL') {
      result = result.filter((f) => getGitStatus(f) === gitFilter);
    }
    if (healthFilter !== 'ALL') {
      if (healthFilter === 'no_eval') {
        result = result.filter((f) => !f.health_status);
      } else {
        result = result.filter((f) => f.health_status === healthFilter);
      }
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'feature_id':
          cmp = a.feature_id.localeCompare(b.feature_id);
          break;
        case 'feature_name':
          cmp = a.feature_name.localeCompare(b.feature_name);
          break;
        case 'feature_status':
          cmp = (STATUS_ORDER[a.feature_status] ?? 0) - (STATUS_ORDER[b.feature_status] ?? 0);
          break;
        case 'current_phase':
          cmp = Number(a.current_phase) - Number(b.current_phase);
          break;
        case 'complexity_level':
          cmp = a.complexity_level - b.complexity_level;
          break;
        case 'overall_score':
          cmp = (a.overall_score ?? -1) - (b.overall_score ?? -1);
          break;
        case 'total_duration_ms':
          cmp = a.total_duration_ms - b.total_duration_ms;
          break;
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [features, search, statusFilter, complexityFilter, severityFilter, gitFilter, healthFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by ID or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FeatureStatus | 'ALL')}
          className="rounded-md border border-border bg-surface px-3 py-2 text-xs"
        >
          <option value="ALL">All Status</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="BLOCKED">Blocked</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select
          value={complexityFilter === 'ALL' ? 'ALL' : String(complexityFilter)}
          onChange={(e) => setComplexityFilter(e.target.value === 'ALL' ? 'ALL' : (Number(e.target.value) as 1 | 2 | 3))}
          className="rounded-md border border-border bg-surface px-3 py-2 text-xs"
        >
          <option value="ALL">All Levels</option>
          <option value="1">L1</option>
          <option value="2">L2</option>
          <option value="3">L3</option>
        </select>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as Severity | 'ALL')}
          className="rounded-md border border-border bg-surface px-3 py-2 text-xs"
        >
          <option value="ALL">All Severity</option>
          <option value="ROUTINE">Routine</option>
          <option value="EXPEDITED">Expedited</option>
          <option value="CRITICAL">Critical</option>
        </select>

        <select
          value={gitFilter}
          onChange={(e) => setGitFilter(e.target.value as GitStatusFilter | 'ALL')}
          className="rounded-md border border-border bg-surface px-3 py-2 text-xs"
        >
          <option value="ALL">All Git</option>
          <option value="no_branch">No Branch</option>
          <option value="has_branch">Has Branch</option>
          <option value="has_pr">Has PR</option>
          <option value="merged">Merged</option>
        </select>

        <select
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value as EvalHealth | 'no_eval' | 'ALL')}
          className="rounded-md border border-border bg-surface px-3 py-2 text-xs"
        >
          <option value="ALL">All Health</option>
          <option value="HEALTHY">Healthy</option>
          <option value="CONCERNING">Concerning</option>
          <option value="CRITICAL">Critical</option>
          <option value="no_eval">No Eval</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} of {features.length} features
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-8 w-8" />}
          title="No features match"
          description="Try adjusting your filters or search query."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort('feature_id')}>
                      <span className="flex items-center gap-1">Feature <SortIcon field="feature_id" /></span>
                    </th>
                    <th className="px-4 py-3">Author</th>
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort('feature_status')}>
                      <span className="flex items-center gap-1">Status <SortIcon field="feature_status" /></span>
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort('current_phase')}>
                      <span className="flex items-center gap-1">Phase <SortIcon field="current_phase" /></span>
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort('complexity_level')}>
                      <span className="flex items-center gap-1">Level <SortIcon field="complexity_level" /></span>
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort('overall_score')}>
                      <span className="flex items-center gap-1">Health <SortIcon field="overall_score" /></span>
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort('total_duration_ms')}>
                      <span className="flex items-center gap-1">Duration <SortIcon field="total_duration_ms" /></span>
                    </th>
                    <th className="px-4 py-3">Git</th>
                    <th className="px-4 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort('created_at')}>
                      <span className="flex items-center gap-1">Created <SortIcon field="created_at" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => {
                    const healthColors = f.health_status ? HEALTH_COLORS[f.health_status] : null;
                    const gitStatus = getGitStatus(f);
                    return (
                      <tr key={f.feature_id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/features/${f.feature_id}`} className="hover:underline">
                            <span className="font-medium">{f.feature_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{f.feature_id}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          {f.author ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              {f.author}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={STATUS_COLORS[f.feature_status]}>
                            {f.feature_status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {PHASE_NAMES[f.current_phase] ?? f.current_phase}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">L{f.complexity_level}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {healthColors ? (
                            <span className={`text-xs font-medium ${healthColors.text}`}>
                              {f.overall_score != null ? Math.round(f.overall_score) : '—'}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                          {formatDuration(f.total_duration_ms)}
                        </td>
                        <td className="px-4 py-3">
                          {gitStatus === 'merged' && (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">Merged</Badge>
                          )}
                          {gitStatus === 'has_pr' && f.pr_url && (
                            <a href={f.pr_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline">
                              PR #{f.pr_number} <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {gitStatus === 'has_branch' && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <GitBranch className="h-3 w-3" />
                            </span>
                          )}
                          {gitStatus === 'no_branch' && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatRelativeTime(f.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
