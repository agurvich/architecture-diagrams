import { useMemo } from 'react';
import { getBezierPath, type Edge, type Node, type Position } from '@xyflow/react';
import { useDiagramStore } from '../../../store/diagramStore';
import { anchorIdFor } from '../../../engine/actorAnchor';
import { resolveNodeColor } from '../../../engine/ancestry';
import { ANCHOR_SIZE, LEAF_SIZE, type Size } from '../../../engine/containerLayout';
import { getHandlePoint, getRectIntersection } from '../floatingEdgeUtils';
import { resolveNodeIcon } from '../../../icons/iconMatcher';
import type { Diagram } from '../../../types/diagram';
import type { EffectiveGraph, EffectiveNode } from '../../../types/effectiveGraph';
import type { GraphNodeType } from '../GraphNode';
import type { GraphEdgeType } from '../GraphEdge';

interface Params {
  diagram: Diagram;
  effectiveGraph: EffectiveGraph;
  orderedNodes: EffectiveNode[];
  sizes: Map<string, Size>;
  positionOf: (n: EffectiveNode) => { x: number; y: number };
  absolutePositions: Map<string, { x: number; y: number }>;
}

/**
 * Turns the effective graph into the actual node/edge arrays React Flow
 * renders: real diagram nodes/edges as their own RF objects, plus a
 * synthetic "actor anchor" node per unambiguous attributed action edge
 * (see engine/actorAnchor.ts) — the small circular badge a trigger edge
 * connects to, positioned live from the current render, never stored.
 */
export function useCanvasNodesAndEdges({
  diagram,
  effectiveGraph,
  orderedNodes,
  sizes,
  positionOf,
  absolutePositions,
}: Params) {
  const selected = useDiagramStore((s) => s.selected);
  const multiSelectedNodeIds = useDiagramStore((s) => s.multiSelectedNodeIds);
  const multiSelectedEdgeIds = useDiagramStore((s) => s.multiSelectedEdgeIds);

  const rfNodes: GraphNodeType[] = useMemo(
    () =>
      orderedNodes.map((n) => {
        const size = sizes.get(n.id)!;
        const node: Node<EffectiveNode, 'graphNode'> = {
          id: n.id,
          type: 'graphNode',
          position: positionOf(n),
          parentId: n.parentId,
          // No `extent: 'parent'` clamp here: nodes need to be draggable
          // past their current container's edges so onNodeDragStop's
          // reparent-on-drop logic can detect the drag leaving (or
          // entering) a container in the first place.
          data: n,
          // Both the CSS box (style) and React Flow's own width/height
          // fields: the latter is what floatingEdgeUtils.ts reads to place
          // an edge on a node's actual border rather than waiting on
          // ResizeObserver to report `measured` back (see the comment
          // there — with a fully controlled, always-new-object node array,
          // that measurement lags on effectively every render).
          style: { width: size.width, height: size.height },
          width: size.width,
          height: size.height,
          draggable: true,
          // Feeds our own selection state back to React Flow so its
          // marquee (shift-drag) box-select and Delete/Backspace key
          // handling both have something to act on — without this, a
          // fully controlled nodes array with no selected flag means the
          // marquee visually draws but never actually selects anything.
          selected: multiSelectedNodeIds.has(n.id) || (selected?.kind === 'node' && selected.id === n.id),
        };
        return node;
      }),
    [orderedNodes, sizes, multiSelectedNodeIds, selected, positionOf],
  );

  const rfEdges: GraphEdgeType[] = useMemo(
    () =>
      effectiveGraph.visibleEdges.map((e) => {
        const edge: Edge<typeof e, 'graphEdge'> = {
          id: e.id,
          type: 'graphEdge',
          source: e.visibleSourceId,
          target: e.visibleTargetId,
          // When set, these tell React Flow's own edge-position resolution
          // (which GraphEdge trusts via its sourceX/sourceY/etc props in
          // that case, instead of computing floating-edge geometry) which
          // exact handle to anchor to. Loose connection mode means it can
          // resolve either id against our source-typed handles regardless
          // of which end of the edge is asking.
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          data: e,
          selected: multiSelectedEdgeIds.has(e.id) || (selected?.kind === 'edge' && selected.id === e.id),
          // Draggable-to-reassign whenever it resolves to exactly one raw
          // edge — a collapsed ancestor standing in for the real endpoint
          // is a real node with its own handles, so there's always
          // exactly one raw record (originalEdgeIds[0]) to write the new
          // endpoint back to, substituted or not.
          reconnectable: e.count === 1,
        };
        return edge;
      }),
    [effectiveGraph.visibleEdges, multiSelectedEdgeIds, selected],
  );

  // Every unambiguous action edge (count === 1, actorId set) gets a small
  // synthetic node at its own midpoint carrying the actor's icon — this is
  // what a trigger edge (see engine/actorAnchor.ts) connects to, so a
  // process step can point at this *specific* action rather than just "the
  // actor" in general, which would be ambiguous the moment an actor
  // performs more than one action in the diagram.
  const actorAnchors: GraphNodeType[] = useMemo(() => {
    const anchors: GraphNodeType[] = [];
    const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]));
    const colorCache = new Map<string, string | undefined>();
    for (const e of effectiveGraph.visibleEdges) {
      if (e.count !== 1 || !e.actorId) continue;
      const actor = diagram.nodes.find((n) => n.id === e.actorId);
      if (!actor) continue;
      const sourcePos = absolutePositions.get(e.visibleSourceId);
      const targetPos = absolutePositions.get(e.visibleTargetId);
      const sourceSize = sizes.get(e.visibleSourceId) ?? LEAF_SIZE;
      const targetSize = sizes.get(e.visibleTargetId) ?? LEAF_SIZE;
      if (!sourcePos || !targetPos) continue;

      const sourceRect = { x: sourcePos.x, y: sourcePos.y, ...sourceSize };
      const targetRect = { x: targetPos.x, y: targetPos.y, ...targetSize };

      // Mirror GraphEdge.tsx's own path math exactly, so the anchor lands
      // on the actual visible curve/line instead of a naive center-to-
      // center average — which for a curvy edge can be far from the bowed
      // bezier, and even for a floating edge misses the true border-to-
      // border midpoint.
      let midX: number;
      let midY: number;
      if (e.sourceHandle && e.targetHandle) {
        const sp = getHandlePoint(sourceRect, e.sourceHandle);
        const tp = getHandlePoint(targetRect, e.targetHandle);
        const [, labelX, labelY] = getBezierPath({
          sourceX: sp.x,
          sourceY: sp.y,
          sourcePosition: e.sourceHandle as Position,
          targetX: tp.x,
          targetY: tp.y,
          targetPosition: e.targetHandle as Position,
        });
        midX = labelX;
        midY = labelY;
      } else {
        const si = getRectIntersection(sourceRect, targetRect);
        const ti = getRectIntersection(targetRect, sourceRect);
        midX = (si.x + ti.x) / 2;
        midY = (si.y + ti.y) / 2;
      }
      const resolvedIconKey = resolveNodeIcon(actor.icon, actor.label, actor.metadata);

      const data: EffectiveNode = {
        id: anchorIdFor(e.originalEdgeIds[0]),
        label: actor.label,
        renderMode: 'actor-anchor',
        position: { x: midX - ANCHOR_SIZE / 2, y: midY - ANCHOR_SIZE / 2 },
        metadata: {},
        // Not actor.color directly — the actor itself may be inheriting
        // its color from an ancestor container (see resolveNodeColor),
        // and it isn't necessarily currently visible/expanded as itself
        // for that inheritance to already be reflected anywhere else.
        color: resolveNodeColor(actor.id, nodeById, colorCache),
        icon: resolvedIconKey,
        linkedEdgeId: e.id,
        dimmed: e.dimmed,
        highlighted: e.highlighted,
      };
      anchors.push({
        id: data.id,
        type: 'graphNode',
        position: data.position,
        data,
        style: { width: ANCHOR_SIZE, height: ANCHOR_SIZE },
        width: ANCHOR_SIZE,
        height: ANCHOR_SIZE,
        // Not part of the authored diagram — dragging or marquee-selecting
        // it as though it were a real node makes no sense; it only exists
        // as a connection target for trigger edges (handled via its own
        // onClick in GraphNode, which selects the underlying action edge
        // instead of ever treating this as a selected node).
        draggable: false,
        selectable: false,
        // Without an explicit zIndex, an anchor's default stacking could
        // still lose to a nearby edge (React Flow elevates an edge's own
        // z-index on hover/selection) and render *behind* it, hiding the
        // actor icon under the line passing through the same point —
        // pin it high enough to always paint on top of any edge.
        zIndex: 1000,
      });
    }
    return anchors;
  }, [effectiveGraph.visibleEdges, diagram.nodes, absolutePositions, sizes]);

  const allRfNodes: GraphNodeType[] = useMemo(() => [...rfNodes, ...actorAnchors], [rfNodes, actorAnchors]);

  // A trigger edge whose action edge is currently merged away by collapse
  // (so no anchor was synthesized for it this render) has nothing valid to
  // point at — drop it rather than hand React Flow an edge referencing a
  // nonexistent node.
  const visibleRfEdges: GraphEdgeType[] = useMemo(() => {
    const nodeIds = new Set(allRfNodes.map((n) => n.id));
    return rfEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  }, [rfEdges, allRfNodes]);

  return { allRfNodes, visibleRfEdges };
}
