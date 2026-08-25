import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  useConnection,
  useInternalNode,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import type { EffectiveEdge } from '../../types/effectiveGraph';
import { useDiagramStore } from '../../store/diagramStore';
import { getFloatingEdgeParams } from './floatingEdgeUtils';
import { isAnchorId } from '../../engine/actorAnchor';

export type GraphEdgeType = Edge<EffectiveEdge, 'graphEdge'>;

export function GraphEdge({
  id,
  source,
  target,
  data,
  selected,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
}: EdgeProps<GraphEdgeType>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const edgeSets = useDiagramStore((s) => s.diagram.edgeSets);
  const setHover = useDiagramStore((s) => s.setHover);
  const select = useDiagramStore((s) => s.select);
  const deleteEdge = useDiagramStore((s) => s.deleteEdge);
  const reverseEdge = useDiagramStore((s) => s.reverseEdge);
  // See GraphNode.tsx: hover-driven recomputation of the effective graph
  // must not happen mid-drag, or it corrupts React Flow's hit-testing for
  // the handle under the cursor and defeats live node-position tracking.
  const connectionInProgress = useConnection((c) => c.inProgress);
  const isNodeDragging = useDiagramStore((s) => s.isNodeDragging);
  const hoverFrozen = connectionInProgress || isNodeDragging;

  if (!sourceNode || !targetNode || !data) return null;

  // A remembered compass anchor (set when this edge was drawn by hand —
  // see computeEffectiveGraph.ts) means React Flow has already resolved
  // sourceX/sourceY/targetX/targetY from the actual handle DOM elements
  // via sourceHandle/targetHandle on the edge object; trust those and
  // draw a curve, matching the look of RF's own in-progress connection
  // line. Otherwise fall back to floating (dynamic center-to-center
  // intersection) geometry with a straight line — the only sensible
  // choice for a merged edge or one with no drawn anchor to remember.
  const hasFixedAnchor = Boolean(data.sourceHandle && data.targetHandle);
  const { sx, sy, tx, ty } = hasFixedAnchor
    ? { sx: sourceX, sy: sourceY, tx: targetX, ty: targetY }
    : getFloatingEdgeParams(sourceNode, targetNode);
  const [edgePath, labelX, labelY] = hasFixedAnchor
    ? getBezierPath({ sourceX: sx, sourceY: sy, sourcePosition, targetX: tx, targetY: ty, targetPosition })
    : getStraightPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty });

  // A trigger edge's own targetId is a synthetic actor-anchor id (see
  // engine/actorAnchor.ts), not a real node — it points at a specific
  // action rather than a resource, so it renders distinctly from a plain
  // control-flow edge and can't be reversed (there's nothing sensible to
  // put in sourceId).
  const isTrigger = isAnchorId(data.visibleTargetId) || isAnchorId(data.visibleSourceId);

  const setColors = data.sets.map((sid) => edgeSets.find((s) => s.id === sid)?.color).filter(Boolean) as string[];
  const strokeColor = setColors.length === 1 ? setColors[0] : '#9098a8';
  const isMultiSet = setColors.length > 1;

  const className = cn(
    'graph-edge transition-opacity duration-150',
    data.dimmed && 'graph-edge--dimmed opacity-15',
    data.highlighted && 'graph-edge--highlighted',
    selected && 'graph-edge--selected',
  );

  const singleRawEdgeId = data.count === 1 ? data.originalEdgeIds[0] : null;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={className}
        style={{
          stroke: strokeColor,
          strokeWidth: data.highlighted ? 3 : 2,
          strokeDasharray: isTrigger ? '2 4' : isMultiSet ? '6 3' : undefined,
        }}
        interactionWidth={16}
        markerEnd="url(#graph-edge-arrow)"
      />
      <EdgeLabelRenderer>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                'graph-edge__label pointer-events-auto absolute flex flex-col items-center gap-0.5 transition-opacity duration-150',
                data.dimmed && 'graph-edge__label--dimmed opacity-15',
              )}
              style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
              onMouseEnter={() => !hoverFrozen && setHover({ kind: 'edge', id })}
              onMouseLeave={() => !hoverFrozen && setHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                select({ kind: 'edge', id });
              }}
            >
              <div className="flex gap-0.5">
                {data.count > 1 && (
                  <span className="graph-edge__count-badge cursor-pointer rounded-full border bg-background px-1.5 text-[10px] text-foreground">
                    {data.count}
                  </span>
                )}
              </div>
              {/* A single raw edge shows its own label; a merged edge shows
                  every distinct label underneath it as a list, since there's
                  no single string that could represent all of them. */}
              {data.labels.length > 0 && (
                <div className="graph-edge__label-text flex max-w-[160px] cursor-pointer flex-col items-center gap-0.5 rounded-md border bg-background px-1.5 py-0.5 text-[10px] leading-tight text-foreground shadow-sm">
                  {data.labels.map((label) => (
                    <span key={label} className="text-center break-words">
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            <ContextMenuItem onClick={() => select({ kind: 'edge', id })}>Edit properties…</ContextMenuItem>
            {singleRawEdgeId ? (
              <>
                {!isTrigger && (
                  <ContextMenuItem onClick={() => reverseEdge(singleRawEdgeId)}>Reverse direction</ContextMenuItem>
                )}
                <ContextMenuItem variant="destructive" onClick={() => deleteEdge(singleRawEdgeId)}>
                  Delete edge
                </ContextMenuItem>
              </>
            ) : (
              <ContextMenuItem disabled>Expand nodes to edit ({data.count} merged)</ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>
      </EdgeLabelRenderer>
    </>
  );
}
