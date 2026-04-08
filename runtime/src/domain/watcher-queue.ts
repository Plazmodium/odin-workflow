import type { WatcherQueueClaim } from '../types.js';

function formatWatcherQueueClaim(claim: WatcherQueueClaim): string {
  const policy_reason = claim.policy_reason == null ? '' : `; policy reason: ${claim.policy_reason}`;
  return `- ${claim.claim_id} [phase ${claim.phase}] ${claim.agent_name} ${claim.claim_type}: ${claim.claim_description}${policy_reason}`;
}

export function buildWatcherQueueNextActions(feature_id: string | null): string[] {
  const verify_feature_id = feature_id ?? '<feature_id>';
  return [
    'Have watcher-agent review each claim_id listed above.',
    'Record each verdict with odin.record_watcher_review({ claim_id: "<claim_id>", verdict: "PASS" | "FAIL", reasoning: "...", watcher_agent: "watcher-agent", confidence: 0.8 }).',
    `Re-run odin.verify_claims({ feature_id: "${verify_feature_id}" }) after all watcher reviews are recorded.`,
  ];
}

export function buildWatcherQueueText(claims: WatcherQueueClaim[], feature_id: string | null, prefix: string): string {
  if (claims.length === 0) {
    return prefix;
  }

  const lines = claims.map(formatWatcherQueueClaim);
  const next_actions = buildWatcherQueueNextActions(feature_id);

  return [prefix, 'Pending watcher queue:', ...lines, 'Next steps:', ...next_actions.map((action) => `- ${action}`)].join('\n');
}
