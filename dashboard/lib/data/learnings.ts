/**
 * Data layer: Learnings queries
 */
import { createServerClient } from '@/lib/supabase';
import type {
  ActiveLearning,
  BridgeLearning,
  DomainCluster,
  DomainClusterLearning,
  Learning,
  LearningCategory,
  PropagationQueueItem,
  PropagationHistoryItem,
  PropagationTargetType,
  OpenConflict,
  LearningChainItem,
  LearningChainSummary,
  SkillPropagationItem,
  SkillPropagationItemWithStatus,
  PropagationStatus,
  LearningPropagationOverview,
  SkillProposalCandidateRecord,
  SkillProposalRecord,
} from '@/lib/types/database';

export async function getActiveLearnings(): Promise<ActiveLearning[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('active_learnings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as ActiveLearning[];
}

export async function getFullLearning(
  learningId: string
): Promise<Learning | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('learnings')
    .select('*')
    .eq('id', learningId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Learning;
}

export async function searchLearnings(
  query: string
): Promise<ActiveLearning[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('learnings')
    .select('*')
    .textSearch('search_vector', query, { type: 'websearch' })
    .eq('is_superseded', false);
  if (error || !data) return [];
  return data as ActiveLearning[];
}

export async function getPropagationQueue(): Promise<PropagationQueueItem[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('propagation_queue')
    .select('*')
    .order('confidence_score', { ascending: false });
  if (error || !data) return [];
  return data as PropagationQueueItem[];
}

export async function getOpenConflicts(): Promise<OpenConflict[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('open_learning_conflicts')
    .select('*')
    .order('detected_at', { ascending: false });
  if (error || !data) return [];
  return data as OpenConflict[];
}

export async function getLearningChain(
  learningId: string
): Promise<LearningChainItem[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('get_learning_chain', {
    p_learning_id: learningId,
  });
  if (error || !data) return [];
  return data as LearningChainItem[];
}

export async function getChainSummaries(): Promise<LearningChainSummary[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('learning_chain_summary')
    .select('*')
    .order('current_confidence', { ascending: false });
  if (error || !data) return [];
  return data as LearningChainSummary[];
}

// ============================================================
// Propagation History (display-only)
// ============================================================

export async function getPropagationHistory(
  limit: number = 50
): Promise<PropagationHistoryItem[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('learning_propagations')
    .select(`
      id,
      learning_id,
      target_type,
      target_path,
      propagated_at,
      propagated_by,
      section,
      learnings!inner (
        title,
        category
      )
    `)
    .order('propagated_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  // Flatten the join
  return data.map((row: Record<string, unknown>) => {
    const learning = row.learnings as { title: string; category: string } | null;
    return {
      id: row.id as string,
      learning_id: row.learning_id as string,
      target_type: row.target_type as string,
      target_path: row.target_path as string | null,
      propagated_at: row.propagated_at as string,
      propagated_by: row.propagated_by as string,
      section: row.section as string | null,
      learning_title: learning?.title ?? 'Unknown',
      learning_category: (learning?.category ?? 'PATTERN') as PropagationHistoryItem['learning_category'],
    };
  });
}

// ============================================================
// Skill Propagation (Migration 021)
// ============================================================

export async function getSkillPropagationQueue(): Promise<
  SkillPropagationItem[]
> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('skill_propagation_queue')
    .select('*')
    .order('confidence_score', { ascending: false });
  if (error || !data) return [];
  return data as SkillPropagationItem[];
}

export async function getAllSkillPropagationTargets(): Promise<
  SkillPropagationItemWithStatus[]
> {
  const supabase = createServerClient();

  // Get all targets with learning info
  const { data: targets, error: targetsError } = await supabase
    .from('learning_propagation_targets')
    .select(`
      learning_id,
      target_type,
      target_path,
      relevance_score,
      learnings!inner (
        title,
        category,
        content,
        confidence_score,
        feature_id
      )
    `)
    .order('relevance_score', { ascending: false });

  if (targetsError || !targets) return [];

  // Get all completed propagations
  const { data: propagations } = await supabase
    .from('learning_propagations')
    .select('learning_id, target_type, target_path, propagated_at, propagated_by');

  const propagatedMap = new Map<string, { propagated_at: string; propagated_by: string }>();
  for (const p of propagations ?? []) {
    const row = p as Record<string, unknown>;
    const key = `${row.learning_id}|${row.target_type}|${row.target_path ?? ''}`;
    propagatedMap.set(key, {
      propagated_at: row.propagated_at as string,
      propagated_by: row.propagated_by as string,
    });
  }

  return targets.map((row: Record<string, unknown>) => {
    const learning = row.learnings as { title: string; category: string; content: string; confidence_score: number; feature_id: string | null };
    const key = `${row.learning_id}|${row.target_type}|${row.target_path ?? ''}`;
    const prop = propagatedMap.get(key);
    return {
      learning_id: row.learning_id as string,
      title: learning.title,
      category: learning.category as import('@/lib/types/database').LearningCategory,
      content: learning.content,
      confidence_score: learning.confidence_score,
      feature_id: learning.feature_id,
      target_type: row.target_type as import('@/lib/types/database').PropagationTargetType,
      target_path: row.target_path as string | null,
      relevance_score: Number(row.relevance_score),
      is_propagated: !!prop,
      propagated_at: prop?.propagated_at ?? null,
      propagated_by: prop?.propagated_by ?? null,
    };
  });
}

export async function getLearningPropagationStatus(
  learningId: string
): Promise<PropagationStatus[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc(
    'get_learning_propagation_status',
    { p_learning_id: learningId }
  );
  if (error || !data) return [];
  return data as PropagationStatus[];
}

// ============================================================
// Propagation Targets for Graph Visualization
// ============================================================

export interface PropagationEdge {
  learning_id: string;
  target_type: string;
  target_path: string | null;
  relevance_score: number;
  is_propagated: boolean;
}

export async function getAllPropagationTargets(): Promise<PropagationEdge[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('learning_propagation_targets')
    .select(`
      learning_id,
      target_type,
      target_path,
      relevance_score
    `);
  if (error || !data) return [];

  // Check which targets have been propagated
  const { data: propagations } = await supabase
    .from('learning_propagations')
    .select('learning_id, target_type, target_path');

  const propagatedSet = new Set(
    (propagations ?? []).map((p: Record<string, unknown>) =>
      `${p.learning_id}|${p.target_type}|${p.target_path ?? ''}`
    )
  );

  return data.map((row: Record<string, unknown>) => ({
    learning_id: row.learning_id as string,
    target_type: row.target_type as string,
    target_path: row.target_path as string | null,
    relevance_score: Number(row.relevance_score),
    is_propagated: propagatedSet.has(
      `${row.learning_id}|${row.target_type}|${row.target_path ?? ''}`
    ),
  }));
}

export async function getLearningPropagationOverview(): Promise<
  LearningPropagationOverview[]
> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('learning_propagation_overview')
    .select('*')
    .order('pending_count', { ascending: false });
  if (error || !data) return [];
  return data as LearningPropagationOverview[];
}

export async function getSkillProposalCandidates(): Promise<SkillProposalCandidateRecord[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('skill_proposal_candidates')
    .select('*')
    .order('latest_learning_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  const rows = data as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    return [];
  }

  const topicKeys = rows.map((row) => String(row.topic_key));
  const { data: evidenceData } = await supabase
    .from('skill_proposal_evidence')
    .select('*')
    .in('proposal_topic_key', topicKeys)
    .order('learning_created_at', { ascending: false });

  const evidenceByTopic = new Map<string, SkillProposalCandidateRecord['recent_examples']>();
  for (const row of (evidenceData as Array<Record<string, unknown>> | null) ?? []) {
    const topicKey = String(row.proposal_topic_key);
    const existing = evidenceByTopic.get(topicKey) ?? [];
    if (!existing.some((item) => item.learning_id === String(row.learning_id))) {
      existing.push({
        learning_id: String(row.learning_id),
        feature_id: String(row.feature_id),
        title: String(row.title),
        learning_created_at: String(row.learning_created_at),
      });
      evidenceByTopic.set(topicKey, existing.slice(0, 3));
    }
  }

  return rows.map((row) => ({
    topic_key: String(row.topic_key),
    display_name: String(row.display_name),
    status: String(row.status) as SkillProposalCandidateRecord['status'],
    evidence_count: Number(row.evidence_count),
    feature_count: Number(row.feature_count),
    sample_tags: Array.isArray(row.sample_tags) ? row.sample_tags.map((value) => String(value)) : [],
    latest_learning_at: String(row.latest_learning_at),
    recent_examples: evidenceByTopic.get(String(row.topic_key)) ?? [],
  })).sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === 'DRAFT_READY' ? -1 : 1;
    }

    if (left.feature_count !== right.feature_count) {
      return right.feature_count - left.feature_count;
    }

    if (left.evidence_count !== right.evidence_count) {
      return right.evidence_count - left.evidence_count;
    }

    const recency = right.latest_learning_at.localeCompare(left.latest_learning_at);
    if (recency !== 0) {
      return recency;
    }

    return left.topic_key.localeCompare(right.topic_key);
  });
}

export async function getSkillProposals(): Promise<SkillProposalRecord[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('skill_proposals')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as Array<Record<string, unknown>>).map((row) => ({
    topic_key: String(row.topic_key),
    display_name: String(row.display_name),
    status: String(row.status) as SkillProposalRecord['status'],
    skill_name: String(row.skill_name),
    skill_category: String(row.skill_category),
    draft_markdown: String(row.draft_markdown),
    validation_errors: Array.isArray(row.validation_errors)
      ? row.validation_errors.map((value) => String(value))
      : [],
    validation_warnings: Array.isArray(row.validation_warnings)
      ? row.validation_warnings.map((value) => String(value))
      : [],
    published_path: row.published_path == null ? null : String(row.published_path),
    decision_notes: row.decision_notes == null ? null : String(row.decision_notes),
    created_by: String(row.created_by),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    approved_by: row.approved_by == null ? null : String(row.approved_by),
    approved_at: row.approved_at == null ? null : String(row.approved_at),
    published_by: row.published_by == null ? null : String(row.published_by),
    published_at: row.published_at == null ? null : String(row.published_at),
  }));
}

// ============================================================
// Knowledge Map (Memory Palace visualization)
// ============================================================

export async function getDomainClusters(): Promise<{
  clusters: DomainCluster[];
  bridges: BridgeLearning[];
}> {
  const supabase = createServerClient();

  // Get all propagation targets with learning details
  const { data: targets, error: targetsError } = await supabase
    .from('learning_propagation_targets')
    .select(`
      learning_id,
      target_type,
      target_path,
      relevance_score,
      learnings!inner (
        id,
        title,
        category,
        confidence_score,
        feature_id,
        is_superseded
      )
    `);

  if (targetsError || !targets) return { clusters: [], bridges: [] };

  // Get completed propagations for is_propagated status
  const { data: propagations } = await supabase
    .from('learning_propagations')
    .select('learning_id, target_type, target_path');

  const propagatedSet = new Set(
    (propagations ?? []).map((p: Record<string, unknown>) =>
      `${p.learning_id}|${p.target_type}|${p.target_path ?? ''}`
    )
  );

  // Group by domain (target_type + target_path)
  const domainMap = new Map<string, {
    target_type: PropagationTargetType;
    target_path: string | null;
    learnings: Map<string, DomainClusterLearning>;
    propagated_count: number;
  }>();

  // Track which domains each learning appears in (for bridges)
  const learningDomains = new Map<string, { title: string; category: LearningCategory; domains: string[] }>();

  for (const row of targets as Record<string, unknown>[]) {
    const learning = row.learnings as {
      id: string; title: string; category: string;
      confidence_score: number; feature_id: string | null; is_superseded: boolean;
    };

    if (learning.is_superseded) continue;

    const targetType = row.target_type as PropagationTargetType;
    const targetPath = row.target_path as string | null;
    const domainKey = `${targetType}|${targetPath ?? ''}`;
    const propKey = `${learning.id}|${targetType}|${targetPath ?? ''}`;
    const isPropagated = propagatedSet.has(propKey);

    if (!domainMap.has(domainKey)) {
      domainMap.set(domainKey, {
        target_type: targetType,
        target_path: targetPath,
        learnings: new Map(),
        propagated_count: 0,
      });
    }

    const domain = domainMap.get(domainKey)!;
    if (!domain.learnings.has(learning.id)) {
      domain.learnings.set(learning.id, {
        id: learning.id,
        title: learning.title,
        category: learning.category as LearningCategory,
        confidence_score: learning.confidence_score,
        feature_id: learning.feature_id,
        is_propagated: isPropagated,
      });
    }
    if (isPropagated) domain.propagated_count++;

    // Track for bridge detection
    const existing = learningDomains.get(learning.id);
    if (existing) {
      if (!existing.domains.includes(domainKey)) {
        existing.domains.push(domainKey);
      }
    } else {
      learningDomains.set(learning.id, {
        title: learning.title,
        category: learning.category as LearningCategory,
        domains: [domainKey],
      });
    }
  }

  // Build clusters
  const clusters: DomainCluster[] = [];
  for (const [domainKey, domain] of domainMap) {
    const label = domain.target_type === 'agents_md'
      ? 'AGENTS.md'
      : domain.target_path ?? domain.target_type;

    clusters.push({
      domain_key: domainKey,
      domain_label: label,
      target_type: domain.target_type,
      target_path: domain.target_path,
      learnings: Array.from(domain.learnings.values())
        .sort((a, b) => b.confidence_score - a.confidence_score),
      density: domain.learnings.size,
      propagated_count: domain.propagated_count,
    });
  }

  clusters.sort((a, b) => b.density - a.density);

  // Build bridges (learnings in 2+ domains)
  const bridges: BridgeLearning[] = [];
  for (const [id, info] of learningDomains) {
    if (info.domains.length >= 2) {
      bridges.push({
        id,
        title: info.title,
        category: info.category,
        domains: info.domains,
      });
    }
  }

  bridges.sort((a, b) => b.domains.length - a.domains.length);

  return { clusters, bridges };
}
