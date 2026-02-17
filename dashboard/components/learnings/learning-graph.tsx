'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { LearningNode } from './learning-node';
import { LearningDetailPanel } from './learning-detail-panel';
import { CATEGORY_COLORS } from '@/lib/constants';
import type { ActiveLearning, LearningCategory, LearningImportance } from '@/lib/types/database';
import type { PropagationEdge } from '@/lib/data/learnings';

interface LearningGraphProps {
  learnings: ActiveLearning[];
  propagationTargets?: PropagationEdge[];
}

// Custom node for propagation targets (skills, agent defs, AGENTS.md)
function PropagationTargetNode({ data }: { data: { label: string; targetType: string; propagatedCount: number; totalCount: number } }) {
  const iconMap: Record<string, string> = {
    skill: '📚',
    agent_definition: '🤖',
    agents_md: '📋',
  };
  const allPropagated = data.propagatedCount === data.totalCount;
  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2" />
      <div className={`px-3 py-2 rounded-lg border text-xs ${
        allPropagated
          ? 'bg-healthy/10 border-healthy/30 text-healthy'
          : 'bg-primary/10 border-primary/30 text-primary'
      }`}>
        <div className="flex items-center gap-1.5">
          <span>{iconMap[data.targetType] ?? '📄'}</span>
          <span className="font-medium truncate max-w-[140px]">{data.label}</span>
        </div>
        <div className="text-[10px] mt-0.5 opacity-70">
          {data.propagatedCount}/{data.totalCount} propagated
        </div>
      </div>
    </>
  );
}

const nodeTypes = {
  learning: LearningNode,
  propagationTarget: PropagationTargetNode,
};

function buildGraph(learnings: ActiveLearning[], propagationTargets: PropagationEdge[] = []) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 120 });

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const learningIds = new Set(learnings.map((l) => l.id));

  // Add learning nodes
  learnings.forEach((l) => {
    g.setNode(l.id, { width: 220, height: 120 });
    nodes.push({
      id: l.id,
      type: 'learning',
      position: { x: 0, y: 0 },
      data: {
        title: l.title,
        category: l.category,
        confidence_score: l.confidence_score,
        importance: l.importance,
        is_superseded: false,
        feature_name: l.feature_name,
      },
    });

    // Evolution edges (predecessor → successor)
    if (l.predecessor_id) {
      const predecessorExists = learnings.some((p) => p.id === l.predecessor_id);
      if (predecessorExists) {
        g.setEdge(l.predecessor_id, l.id);
        edges.push({
          id: `evo-${l.predecessor_id}-${l.id}`,
          source: l.predecessor_id,
          target: l.id,
          animated: true,
          style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.5 },
          label: 'evolved',
          labelStyle: { fontSize: 9, fill: 'hsl(var(--muted-foreground))' },
        });
      }
    }
  });

  // Build propagation target nodes (deduplicated by target_type + target_path)
  if (propagationTargets.length > 0) {
    const targetMap = new Map<string, { targetType: string; targetPath: string | null; learningIds: string[]; propagatedCount: number }>();

    for (const pt of propagationTargets) {
      if (!learningIds.has(pt.learning_id)) continue; // skip if learning is filtered out
      const key = `${pt.target_type}|${pt.target_path ?? ''}`;
      if (!targetMap.has(key)) {
        targetMap.set(key, { targetType: pt.target_type, targetPath: pt.target_path, learningIds: [], propagatedCount: 0 });
      }
      const entry = targetMap.get(key)!;
      entry.learningIds.push(pt.learning_id);
      if (pt.is_propagated) entry.propagatedCount++;
    }

    for (const [key, target] of targetMap) {
      const nodeId = `target-${key}`;
      const label = target.targetType === 'agents_md'
        ? 'AGENTS.md'
        : target.targetPath ?? target.targetType;

      g.setNode(nodeId, { width: 180, height: 60 });
      nodes.push({
        id: nodeId,
        type: 'propagationTarget',
        position: { x: 0, y: 0 },
        data: {
          label,
          targetType: target.targetType,
          propagatedCount: target.propagatedCount,
          totalCount: target.learningIds.length,
        },
      });

      // Add edges from each learning to this target
      for (const lid of target.learningIds) {
        const isPropagated = propagationTargets.some(
          (pt) => pt.learning_id === lid && pt.target_type === target.targetType && pt.target_path === target.targetPath && pt.is_propagated
        );
        g.setEdge(lid, nodeId);
        edges.push({
          id: `prop-${lid}-${key}`,
          source: lid,
          target: nodeId,
          animated: false,
          style: {
            stroke: isPropagated ? 'hsl(142, 71%, 45%)' : 'hsl(217, 91%, 60%)',
            strokeWidth: 1,
            strokeDasharray: isPropagated ? undefined : '5 3',
          },
          label: isPropagated ? '✓' : '…',
          labelStyle: { fontSize: 10, fill: isPropagated ? 'hsl(142, 71%, 45%)' : 'hsl(217, 91%, 60%)' },
        });
      }
    }
  }

  dagre.layout(g);

  nodes.forEach((node) => {
    const pos = g.node(node.id);
    if (pos) {
      const halfWidth = node.type === 'propagationTarget' ? 90 : 110;
      const halfHeight = node.type === 'propagationTarget' ? 30 : 60;
      node.position = { x: pos.x - halfWidth, y: pos.y - halfHeight };
    }
  });

  return { nodes, edges };
}

export function LearningGraph({ learnings, propagationTargets = [] }: LearningGraphProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<LearningCategory | 'ALL'>('ALL');
  const [minConfidence, setMinConfidence] = useState(0);
  const [importanceFilter, setImportanceFilter] = useState<LearningImportance | 'ALL'>('ALL');
  const [showPropagation, setShowPropagation] = useState(true);

  const filteredLearnings = useMemo(() => {
    return learnings.filter((l) => {
      if (categoryFilter !== 'ALL' && l.category !== categoryFilter) return false;
      if (l.confidence_score < minConfidence) return false;
      if (importanceFilter !== 'ALL' && l.importance !== importanceFilter) return false;
      return true;
    });
  }, [learnings, categoryFilter, minConfidence, importanceFilter]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(filteredLearnings, showPropagation ? propagationTargets : []),
    [filteredLearnings, propagationTargets, showPropagation]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes/edges when filters change
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedId(node.id);
  }, []);

  const selectedLearning = learnings.find((l) => l.id === selectedId) ?? null;

  const categories: LearningCategory[] = [
    'DECISION', 'PATTERN', 'GOTCHA', 'CONVENTION',
    'ARCHITECTURE', 'RATIONALE', 'OPTIMIZATION', 'INTEGRATION',
  ];

  return (
    <div className="flex h-[calc(100vh-12rem)]">
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="hsl(var(--border))" gap={20} />
          <Controls
            showInteractive={false}
            style={{ button: { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' } } as React.CSSProperties}
          />
          <MiniMap
            nodeColor={(node) => CATEGORY_COLORS[(node.data as { category: LearningCategory }).category] ?? '#71717a'}
            style={{ backgroundColor: 'hsl(var(--card))' }}
          />

          {/* Filters Panel */}
          <Panel position="top-left" className="bg-card border border-border rounded-lg p-3 space-y-3 max-w-xs">
            <p className="text-xs font-medium text-muted-foreground">
              {filteredLearnings.length} / {learnings.length} learnings
            </p>

            {/* Category Filter */}
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as LearningCategory | 'ALL')}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Confidence Filter */}
            <div>
              <label className="text-xs text-muted-foreground">
                Min Confidence: {Math.round(minConfidence * 100)}%
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                className="mt-1 w-full"
              />
            </div>

            {/* Importance Filter */}
            <div>
              <label className="text-xs text-muted-foreground">Importance</label>
              <div className="mt-1 flex gap-1">
                {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((imp) => (
                  <button
                    key={imp}
                    onClick={() => setImportanceFilter(imp)}
                    className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                      importanceFilter === imp
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {imp}
                  </button>
                ))}
              </div>
            </div>

            {/* Propagation Toggle */}
            {propagationTargets.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Show propagations</label>
                <button
                  onClick={() => setShowPropagation(!showPropagation)}
                  className={`w-8 h-4 rounded-full transition-colors relative ${
                    showPropagation ? 'bg-healthy' : 'bg-muted'
                  }`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                    showPropagation ? 'left-4' : 'left-0.5'
                  }`} />
                </button>
              </div>
            )}
          </Panel>
        </ReactFlow>
      </div>

      {/* Detail Panel */}
      {selectedLearning && (
        <LearningDetailPanel
          learning={selectedLearning}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
