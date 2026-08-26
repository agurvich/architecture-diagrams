import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { CompassSide, EdgeSetId, NodeId } from '../../types/diagram';
import { useDiagramStore } from '../../store/diagramStore';
import { actionEdgeIdFromAnchor, isAnchorId } from '../../engine/actorAnchor';
import { EdgeSetRow } from '../shared/EdgeSetRow';
import { clampToViewport } from '../../utils/clampToViewport';

const POPOVER_WIDTH = 220;
const POPOVER_HEIGHT = 220;
const VIEWPORT_MARGIN = 10;

export interface PendingConnection {
  sourceId: string;
  targetId: string;
  screenX: number;
  screenY: number;
  /** The compass side of each node actually dragged from/to, so the confirmed edge remembers its anchor instead of falling back to floating geometry. */
  sourceHandle?: CompassSide;
  targetHandle?: CompassSide;
}

interface Props {
  pending: PendingConnection;
  onDone: () => void;
}

export function ConnectionPopover({ pending, onDone }: Props) {
  const edgeSets = useDiagramStore((s) => s.diagram.edgeSets);
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const addEdge = useDiagramStore((s) => s.addEdge);
  const [selectedSets, setSelectedSets] = useState<Set<EdgeSetId>>(new Set());
  const [actorId, setActorId] = useState<NodeId | ''>('');
  const idPrefix = useId();

  // Dropped onto an actor-anchor (the midpoint of an existing action edge)
  // rather than a real node: this is a trigger, not an actor attribution —
  // "this step causes that specific action", so no set/actor selection to
  // make, just confirm.
  const triggerTarget = isAnchorId(pending.targetId)
    ? edges.find((e) => e.id === actionEdgeIdFromAnchor(pending.targetId))
    : undefined;
  const triggerActorLabel = triggerTarget?.actorId ? nodes.find((n) => n.id === triggerTarget.actorId)?.label : undefined;
  const actorNodes = nodes.filter((n) => n.isActor);

  const clampedPosition = useMemo(
    () => clampToViewport(pending.screenX, pending.screenY, POPOVER_WIDTH, POPOVER_HEIGHT, VIEWPORT_MARGIN),
    [pending.screenX, pending.screenY],
  );

  const toggleSet = (id: EdgeSetId) => {
    setSelectedSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = () => {
    if (selectedSets.size === 0) return;
    addEdge(
      pending.sourceId,
      pending.targetId,
      [...selectedSets],
      pending.sourceHandle,
      pending.targetHandle,
      triggerTarget ? undefined : actorId || undefined,
    );
    onDone();
  };

  return (
    <div
      className="connection-popover fixed z-30 flex w-[220px] flex-col gap-2 rounded-lg border bg-popover p-2.5 text-popover-foreground shadow-lg"
      style={{ left: clampedPosition.left, top: clampedPosition.top }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs font-semibold">{triggerTarget ? 'New trigger — tag sets' : 'New edge — tag sets'}</div>
      {triggerTarget && (
        <p className="m-0 text-[11px] text-muted-foreground">
          Triggers {triggerActorLabel ? `${triggerActorLabel}'s action` : 'this action'} between{' '}
          {nodes.find((n) => n.id === triggerTarget.sourceId)?.label} → {nodes.find((n) => n.id === triggerTarget.targetId)?.label}.
        </p>
      )}
      {!triggerTarget && actorNodes.length > 0 && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}-actor`} className="text-xs">
            Actor (optional)
          </Label>
          <select
            id={`${idPrefix}-actor`}
            className="h-8 rounded-md border bg-transparent px-2 text-xs shadow-xs"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
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
      <div className="flex flex-col gap-1">
        {edgeSets.map((s) => (
          <EdgeSetRow
            key={s.id}
            set={s}
            checked={selectedSets.has(s.id)}
            onToggle={() => toggleSet(s.id)}
            inputId={`${idPrefix}-${s.id}`}
            compact
          />
        ))}
      </div>
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" disabled={selectedSets.size === 0} onClick={confirm}>
          Add edge
        </Button>
      </div>
    </div>
  );
}
