import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  useConnection,
  useInternalNode,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { EffectiveEdge } from '../../types/effectiveGraph';
import { useDiagramStore } from '../../store/diagramStore';
import { getFloatingEdgeParams } from './floatingEdgeUtils';

export type GraphEdgeType = Edge<EffectiveEdge, 'graphEdge'>;

export function GraphEdge({ id, source, target, data, selected }: EdgeProps<GraphEdgeType>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const edgeSets = useDiagramStore((s) => s.diagram.edgeSets);
  const setHover = useDiagramStore((s) => s.setHover);
  const select = useDiagramStore((s) => s.select);
  // See GraphNode.tsx: hover-driven recomputation of the effective graph
  // must not happen mid-drag, or it corrupts React Flow's hit-testing for
  // the handle under the cursor and defeats live node-position tracking.
  const connectionInProgress = useConnection((c) => c.inProgress);
  const isNodeDragging = useDiagramStore((s) => s.isNodeDragging);
  const hoverFrozen = connectionInProgress || isNodeDragging;

  if (!sourceNode || !targetNode || !data) return null;

  const { sx, sy, tx, ty } = getFloatingEdgeParams(sourceNode, targetNode);
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty });

  const setColors = data.sets.map((sid) => edgeSets.find((s) => s.id === sid)?.color).filter(Boolean) as string[];
  const strokeColor = setColors.length === 1 ? setColors[0] : '#9098a8';
  const isMultiSet = setColors.length > 1;

  const className = cn(
    'graph-edge transition-opacity duration-150',
    data.dimmed && 'graph-edge--dimmed opacity-15',
    data.highlighted && 'graph-edge--highlighted',
    selected && 'graph-edge--selected',
  );

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={className}
        style={{ stroke: strokeColor, strokeWidth: data.highlighted ? 3 : 2, strokeDasharray: isMultiSet ? '6 3' : undefined }}
        interactionWidth={16}
        markerEnd="url(#graph-edge-arrow)"
      />
      <EdgeLabelRenderer>
        <div
          className={cn(
            'graph-edge__label pointer-events-auto absolute flex gap-0.5 transition-opacity duration-150',
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
          {data.level === 'group' && (
            <span
              className="graph-edge__level-badge cursor-pointer rounded-full border border-primary bg-accent px-1.5 text-[10px] text-primary"
              title="Group-level edge"
            >
              G
            </span>
          )}
          {data.count > 1 && (
            <span className="graph-edge__count-badge cursor-pointer rounded-full border bg-background px-1.5 text-[10px] text-foreground">
              {data.count}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
