import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { AutonomousSelection, RuntimeToolClient } from '../types.js';

const execFileAsync = promisify(execFile);

export interface PullRequestInfo {
  url: string;
  number: number;
}

export interface GitHubCommandRunner {
  pushBranch(project_root: string, branch_name: string): Promise<void>;
  findPullRequest(project_root: string, branch_name: string, base_branch: string): Promise<PullRequestInfo | null>;
  createPullRequest(project_root: string, title: string, body: string, base_branch: string, branch_name: string): Promise<void>;
}

function ensureString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Release handoff requires ${field}.`);
  }

  return value;
}

function buildArchiveSummary(selection: AutonomousSelection): string {
  return `[${selection.feature_id}] ${selection.feature_name}`;
}

function buildPrTitle(selection: AutonomousSelection): string {
  return `[${selection.feature_id}] ${selection.feature_name}`;
}

function buildPrBody(selection: AutonomousSelection): string {
  const release_notes = selection.release_notes?.trim() ?? '';
  const notes_body = release_notes.length > 0 ? release_notes : `_No release notes were recorded for ${selection.feature_id}._`;

  return [
    '## Summary',
    notes_body,
    '',
    '## Automation',
    '- Pull request created by Ralph Loop under the configured `auto_pr` policy.',
    '- Human review and merge remain required.',
  ].join('\n');
}

export function createGitHubCommandRunner(): GitHubCommandRunner {
  return {
    async pushBranch(project_root, branch_name) {
      await execFileAsync('git', ['push', '-u', 'origin', branch_name], {
        cwd: project_root,
      });
    },
    async findPullRequest(project_root, branch_name, base_branch) {
      const { stdout } = await execFileAsync(
        'gh',
        ['pr', 'list', '--head', branch_name, '--base', base_branch, '--json', 'number,url', '--limit', '1'],
        { cwd: project_root },
      );
      const parsed = JSON.parse(stdout) as Array<{ number?: number; url?: string }>;
      const match = parsed[0];
      if (match == null || typeof match.number !== 'number' || typeof match.url !== 'string') {
        return null;
      }

      return {
        number: match.number,
        url: match.url,
      };
    },
    async createPullRequest(project_root, title, body, base_branch, branch_name) {
      await execFileAsync(
        'gh',
        ['pr', 'create', '--title', title, '--body', body, '--base', base_branch, '--head', branch_name],
        { cwd: project_root },
      );
    },
  };
}

export async function executeReleaseHandoff(
  client: RuntimeToolClient,
  selection: AutonomousSelection,
  supervisor_name: string,
  project_root: string,
  runner: GitHubCommandRunner = createGitHubCommandRunner(),
): Promise<void> {
  const branch_name = ensureString(selection.branch_name, 'feature branch name');
  const base_branch = ensureString(selection.base_branch, 'base branch');
  const archive_summary = buildArchiveSummary(selection);
  const pr_title = buildPrTitle(selection);
  const pr_body = buildPrBody(selection);

  await client.archiveFeatureRelease({
    feature_id: selection.feature_id,
    summary: archive_summary,
    archived_by: supervisor_name,
    ...(selection.release_notes == null ? {} : { release_notes: selection.release_notes }),
  });

  await runner.pushBranch(project_root, branch_name);

  let pr = await runner.findPullRequest(project_root, branch_name, base_branch);
  if (pr == null) {
    await runner.createPullRequest(project_root, pr_title, pr_body, base_branch, branch_name);
    pr = await runner.findPullRequest(project_root, branch_name, base_branch);
  }

  if (pr == null) {
    throw new Error(`Release handoff could not find a pull request for branch ${branch_name}.`);
  }

  await client.recordPullRequest({
    feature_id: selection.feature_id,
    pr_url: pr.url,
    pr_number: pr.number,
  });

  await client.recordReleaseHandoff({
    feature_id: selection.feature_id,
    summary: `Release handoff prepared and PR #${pr.number} recorded.`,
    created_by: supervisor_name,
  });
}
