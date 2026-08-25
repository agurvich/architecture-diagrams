import { useId, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Minus, Spline } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useDiagramStore } from '../../../store/diagramStore';
import { computeEffectiveGraph } from '../../../engine/computeEffectiveGraph';
import { getFloatingEdgeParams } from '../../Canvas/floatingEdgeUtils';
import { isAnchorId } from '../../../engine/actorAnchor';
import type { DiagramNode, EdgeId, NodeId } from '../../../types/diagram';

/** Every strict ancestor of nodeId, nearest first — walking parentId up to the root. */
function ancestorChain(nodes: DiagramNode[], nodeId: NodeId): NodeId[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: NodeId[] = [];
  let current = byId.get(nodeId)?.parentId;
  const seen = new Set<NodeId>();
  while (current && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = byId.get(current)?.parentId;
  }
  return chain;
}

export function EdgePropertiesPanel({ effectiveEdgeId }: { effectiveEdgeId: string }) {
  const diagram = useDiagramStore((s) => s.diagram);
  const activeSets = useDiagramStore((s) => s.activeSets);
  const expandedNodes = useDiagramStore((s) => s.expandedNodes);
  const updateEdge = useDiagramStore((s) => s.updateEdge);
  const deleteEdge = useDiagramStore((s) => s.deleteEdge);
  const select = useDiagramStore((s) => s.select);
  const expandNodes = useDiagramStore((s) => s.expandNodes);
  const { getInternalNode } = useReactFlow();
  const idPrefix = useId();

  // Expands every collapsed ancestor standing between a raw edge's
  // endpoints and the canvas, then selects it directly — the actionable
  // version of "expand nodes until this resolves to a single edge".
  const revealRawEdge = (raw: { sourceId: NodeId; targetId: NodeId }) => {
    expandNodes([...ancestorChain(diagram.nodes, raw.sourceId), ...ancestorChain(diagram.nodes, raw.targetId)]);
    select({ kind: 'edge', id: `merged:${raw.sourceId}=>${raw.targetId}` });
  };

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
          underlying relationships. Click one below to expand and select it directly.
        </p>
        <ul className="flex flex-col gap-1 text-xs">
          {effEdge.originalEdgeIds.map((id) => {
            const raw = diagram.edges.find((e) => e.id === id);
            if (!raw) return null;
            return (
              <li key={id}>
                <button
                  className="flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent px-1 py-0.5 text-left hover:bg-accent"
                  onClick={() => revealRawEdge(raw)}
                >
                  {nodeLabel(raw.sourceId)} → {nodeLabel(raw.targetId)}
                  {raw.metadata.label && (
                    <span className="truncate text-muted-foreground">“{raw.metadata.label}”</span>
                  )}
                </button>
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

  // A trigger edge (target is an actor-anchor, not a real node) has no
  // attribution of its own to set — the actor it points at already IS the
  // action's own attribution.
  const isTrigger = isAnchorId(rawEdge.targetId);
  const actorNodes = diagram.nodes.filter((n) => n.isActor);

  const toggleSet = (setId: string) => {
    const has = rawEdge.sets.includes(setId);
    updateEdge(rawEdgeId, { sets: has ? rawEdge.sets.filter((s) => s !== setId) : [...rawEdge.sets, setId] });
  };

  const hasFixedAnchor = Boolean(rawEdge.sourceHandle && rawEdge.targetHandle);
  const toggleAnchor = () => {
    if (hasFixedAnchor) {
      updateEdge(rawEdgeId, { sourceHandle: undefined, targetHandle: undefined });
      return;
    }
    // Turning a floating edge into a fixed one with no drag gesture to
    // anchor it to: snapshot whichever side the floating (dynamic
    // center-to-center) geometry currently resolves to, and pin that.
    const sourceInternal = getInternalNode(effEdge.visibleSourceId);
    const targetInternal = getInternalNode(effEdge.visibleTargetId);
    if (!sourceInternal || !targetInternal) return;
    const { sourcePos, targetPos } = getFloatingEdgeParams(sourceInternal, targetInternal);
    updateEdge(rawEdgeId, { sourceHandle: sourcePos, targetHandle: targetPos });
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

      {!isTrigger && actorNodes.length > 0 && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}-actor`}>Actor</Label>
          <select
            id={`${idPrefix}-actor`}
            className="h-9 rounded-md border bg-transparent px-2 text-sm shadow-xs"
            value={rawEdge.actorId ?? ''}
            onChange={(e) => updateEdge(rawEdgeId, { actorId: e.target.value || undefined })}
          >
            <option value="">(none)</option>
            {actorNodes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label htmlFor={`${idPrefix}-anchor`}>Anchor</Label>
        <div className="flex items-center gap-2">
          <Minus size={16} className={hasFixedAnchor ? 'text-muted-foreground' : 'text-foreground'} aria-hidden />
          <Switch id={`${idPrefix}-anchor`} checked={hasFixedAnchor} onCheckedChange={toggleAnchor} />
          <Spline size={16} className={hasFixedAnchor ? 'text-foreground' : 'text-muted-foreground'} aria-hidden />
        </div>
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
