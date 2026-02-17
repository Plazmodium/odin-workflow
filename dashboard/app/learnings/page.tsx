export const dynamic = 'force-dynamic';

import { getActiveLearnings, getPropagationHistory, getOpenConflicts, getAllSkillPropagationTargets, getAllPropagationTargets } from '@/lib/data/learnings';
import { LearningGraph } from '@/components/learnings/learning-graph';
import { PropagationHistoryTable } from '@/components/learnings/propagation-history-table';
import { SkillPropagationQueue } from '@/components/learnings/skill-propagation-queue';
import { ConflictsTable } from '@/components/learnings/conflicts-table';
import { PollingSubscription } from '@/components/realtime/realtime-page';
import { PanelInfoTooltip } from '@/components/shared/panel-info-tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Brain, CheckCircle, ShieldAlert, FileCode } from 'lucide-react';
import { EmptyState } from '@/components/layout/empty-state';

export default async function LearningsPage() {
  const [learnings, propagationHistory, allSkillTargets, conflicts, propagationTargets] = await Promise.all([
    getActiveLearnings(),
    getPropagationHistory(),
    getAllSkillPropagationTargets(),
    getOpenConflicts(),
    getAllPropagationTargets(),
  ]);

  if (learnings.length === 0) {
    return (
      <>
      <PollingSubscription />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Learnings
            <PanelInfoTooltip text="Knowledge captured during feature development. Learnings evolve as understanding deepens and propagate to documentation when confidence is high enough." />
          </h1>
          <p className="text-sm text-muted-foreground">
            Knowledge evolution graph and propagation management
          </p>
        </div>
        <EmptyState
          icon={<Brain className="h-10 w-10" />}
          title="No learnings yet"
          description="Learnings are created during the SDD workflow as agents discover patterns, decisions, and conventions."
        />
      </div>
      </>
    );
  }

  // Stats
  const highConfidence = learnings.filter((l) => l.confidence_score >= 0.8).length;
  const propagated = learnings.filter((l) => l.is_propagated).length;
  const categories = new Set(learnings.map((l) => l.category));

  return (
    <>
    <PollingSubscription />
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Learnings
          <PanelInfoTooltip text="Knowledge captured during feature development. Learnings evolve as understanding deepens and propagate to documentation when confidence is high enough." />
        </h1>
        <p className="text-sm text-muted-foreground">
          Knowledge evolution graph and propagation management
        </p>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Brain className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{learnings.length}</span>
          <span className="text-muted-foreground">active</span>
        </div>
        <span className="text-border">|</span>
        <div>
          <span className="font-medium text-healthy">{highConfidence}</span>
          <span className="text-muted-foreground ml-1">high confidence</span>
        </div>
        <span className="text-border">|</span>
        <div>
          <span className="font-medium">{propagated}</span>
          <span className="text-muted-foreground ml-1">propagated</span>
        </div>
        <span className="text-border">|</span>
        <div>
          <span className="font-medium">{categories.size}</span>
          <span className="text-muted-foreground ml-1">categories</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="graph">
        <TabsList>
          <TabsTrigger value="graph">
            <Brain className="h-3.5 w-3.5 mr-1.5" />
            Evolution Graph
          </TabsTrigger>
          <TabsTrigger value="propagation">
            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
            Propagation History
            {propagationHistory.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
                {propagationHistory.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="skill-propagation">
            <FileCode className="h-3.5 w-3.5 mr-1.5" />
            Skill Targets
            {allSkillTargets.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
                {allSkillTargets.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="conflicts">
            <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
            Conflicts
            {conflicts.length > 0 && (
              <Badge variant="critical" className="ml-1.5 text-[10px] px-1.5">
                {conflicts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="graph">
          <LearningGraph learnings={learnings} propagationTargets={propagationTargets} />
        </TabsContent>

        <TabsContent value="propagation">
          <PropagationHistoryTable items={propagationHistory} />
        </TabsContent>

        <TabsContent value="skill-propagation">
          <SkillPropagationQueue items={allSkillTargets} />
        </TabsContent>

        <TabsContent value="conflicts">
          <ConflictsTable conflicts={conflicts} />
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
