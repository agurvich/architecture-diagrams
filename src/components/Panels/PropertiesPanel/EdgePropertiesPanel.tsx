import { useId, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDiagramStore } from '../../../store/diagramStore';
import { computeEffectiveGraph } from '../../../engine/computeEffectiveGraph';
import type { EdgeId } from '../../../types/diagram';

export function EdgePropertiesPanel({ effectiveEdgeId }: { effectiveEdgeId: string }) {
  const diagram = useDiagramStore((s) => s.diagram);
  const activeSets = useDiagramStore((s) => s.activeSets);
  const expandedNodes = useDiagramStore((s) => s.expandedNodes);
  const updateEdge = useDiagramStore((s) => s.updateEdge);
  const deleteEdge = useDiagramStore((s) => s.deleteEdge);
  const select = useDiagramStore((s) => s.select);
  const idPrefix = useId();

  const effectiveGraph = useMemo(
    () => computeEffectiveGraph(diagram, { activeSets, expandedNodes }),
    [diagram, activeSets, expandedNodes],
  );
  const effEdge = effectiveGraph.visibleEdges.find((e) => e.id === effectiveEdgeId);

  if (!effEdge) return null;

  const nodeLabel = (id: string) => diagram.nodes.find((n) => n.id === id)?.label ?? id;

  if (effEdge.count > 1) {
    return (
      <div className="properties-panel flex flex-col gap-2.5 rounded-lg border bg-card p-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Merged edge ({effEdge.count})
          </h3>
          <button className="cursor-pointer rounded border-none bg-transparent px-1.5 py-0.5 hover:bg-accent" onClick={() => select(null)}>
            ✕
          </button>
        </div>
        <p className="m-0 text-xs text-muted-foreground">
          {nodeLabel(effEdge.visibleSourceId)} → {nodeLabel(effEdge.visibleTargetId)} represents {effEdge.count}{' '}
          underlying relationships. Expand nodes until this resolves to a single edge to edit it directly.
        </p>
        <ul className="flex flex-col gap-1 text-xs">
          {effEdge.originalEdgeIds.map((id) => {
            const raw = diagram.edges.find((e) => e.id === id);
            if (!raw) return null;
            return (
              <li key={id} className="flex items-center gap-1.5">
                {nodeLabel(raw.sourceId)} → {nodeLabel(raw.targetId)}
                <Badge variant="outline" className="text-[10px]">
                  {raw.level}
                </Badge>
                {raw.metadata.label && (
                  <span className="truncate text-muted-foreground">“{raw.metadata.label}”</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const rawEdgeId: EdgeId = effEdge.originalEdgeIds[0];
  const rawEdge = diagram.edges.find((e) => e.id === rawEdgeId);
  if (!rawEdge) return null;

  const toggleSet = (setId: string) => {
    const has = rawEdge.sets.includes(setId);
    updateEdge(rawEdgeId, { sets: has ? rawEdge.sets.filter((s) => s !== setId) : [...rawEdge.sets, setId] });
  };

  return (
    <div className="properties-panel flex flex-col gap-2.5 rounded-lg border bg-card p-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edge</h3>
        <button className="cursor-pointer rounded border-none bg-transparent px-1.5 py-0.5 hover:bg-accent" onClick={() => select(null)}>
          ✕
        </button>
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        {nodeLabel(rawEdge.sourceId)} → {nodeLabel(rawEdge.targetId)}
      </p>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Sets</span>
        {diagram.edgeSets.map((s) => {
          const inputId = `${idPrefix}-set-${s.id}`;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <Checkbox id={inputId} checked={rawEdge.sets.includes(s.id)} onCheckedChange={() => toggleSet(s.id)} />
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              <Label htmlFor={inputId} className="cursor-pointer font-normal">
                {s.name}
              </Label>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-level`}>Level</Label>
        <select
          id={`${idPrefix}-level`}
          className="h-9 rounded-md border bg-transparent px-2 text-sm shadow-xs"
          value={rawEdge.level}
          onChange={(e) => updateEdge(rawEdgeId, { level: e.target.value as 'node' | 'group' })}
        >
          <option value="node">Node-level</option>
          <option value="group">Group-level</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-edge-label`}>Label</Label>
        <Input
          id={`${idPrefix}-edge-label`}
          type="text"
          value={rawEdge.metadata.label ?? ''}
          onChange={(e) => updateEdge(rawEdgeId, { metadata: { ...rawEdge.metadata, label: e.target.value } })}
        />
      </div>

      <Button
        variant="destructive"
        onClick={() => {
          deleteEdge(rawEdgeId);
          select(null);
        }}
      >
        Delete edge
      </Button>
    </div>
  );
}
