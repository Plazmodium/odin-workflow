import { Badge } from '@/components/ui/badge';
import { PHASE_NAMES } from '@/lib/types/database';
import { formatRelativeTime } from '@/lib/utils';
import type { FeatureCommit } from '@/lib/types/database';

interface CommitsTableProps {
  commits: FeatureCommit[];
}

export function CommitsTable({ commits }: CommitsTableProps) {
  if (commits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No commits recorded yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-4">Hash</th>
            <th className="pb-2 pr-4">Phase</th>
            <th className="pb-2 pr-4">Message</th>
            <th className="pb-2 pr-4 text-right">+/-</th>
            <th className="pb-2 pr-4 text-right">Files</th>
            <th className="pb-2">When</th>
          </tr>
        </thead>
        <tbody>
          {commits.map((c) => (
            <tr key={c.id} className="border-b border-border/50">
              <td className="py-2 pr-4">
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  {c.commit_hash.slice(0, 7)}
                </code>
              </td>
              <td className="py-2 pr-4">
                <Badge variant="outline" className="text-xs">
                  {PHASE_NAMES[c.phase] ?? c.phase}
                </Badge>
              </td>
              <td className="py-2 pr-4 max-w-[300px] truncate">
                {c.message ?? '—'}
              </td>
              <td className="py-2 pr-4 text-right font-mono text-xs">
                {c.insertions != null && (
                  <span className="text-green-400">+{c.insertions}</span>
                )}
                {c.deletions != null && (
                  <span className="text-red-400 ml-1">-{c.deletions}</span>
                )}
              </td>
              <td className="py-2 pr-4 text-right text-xs text-muted-foreground">
                {c.files_changed ?? '—'}
              </td>
              <td className="py-2 text-xs text-muted-foreground">
                {formatRelativeTime(c.committed_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
