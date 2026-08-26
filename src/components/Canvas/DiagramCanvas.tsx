import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  ConnectionMode,
  Controls,
  ReactFlow,
  useReactFlow,
  type Node,
  type Edge,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type OnConnectEnd,
  type OnNodeDrag,
  type OnReconnect,
  type OnSelectionChangeFunc,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDiagramStore } from '../../store/diagramStore';
import { computeEffectiveGraph } from '../../engine/computeEffectiveGraph';
import { buildAncestryIndex, isAncestor } from '../../engine/ancestry';
import { anchorIdFor } from '../../engine/actorAnchor';
import {
  ANCHOR_SIZE,
  CONTAINER_HEADER_HEIGHT,
  CONTAINER_PADDING,
  LEAF_SIZE,
  computeAutoLayoutPositions,
  computeContainerSizes,
  topoSort,
} from '../../engine/containerLayout';
import { getFloatingEdgeParams } from './floatingEdgeUtils';
import { guessIconKey } from '../../icons/iconMatcher';
import type { EffectiveNode } from '../../types/effectiveGraph';
import { GraphNode, type GraphNodeType } from './GraphNode';
import { GraphEdge, type GraphEdgeType } from './GraphEdge';
import { ConnectionPopover, type PendingConnection } from './ConnectionPopover';
import { PaneContextMenu } from './PaneContextMenu';

const nodeTypes = { graphNode: GraphNode };
const edgeTypes = { graphEdge: GraphEdge };

export function DiagramCanvas() {
  const diagram = useDiagramStore((s) => s.diagram);
  const activeSets = useDiagramStore((s) => s.activeSets);
  const expandedNodes = useDiagramStore((s) => s.expandedNodes);
  const expandNodes = useDiagramStore((s) => s.expandNodes);
  const hoverTarget = useDiagramStore((s) => s.hoverTarget);
  const currentFrameId = useDiagramStore((s) => s.currentFrameId);
  const editingHighlightsForFrameId = useDiagramStore((s) => s.editingHighlightsForFrameId);
  const setEditingHighlightsForFrame = useDiagramStore((s) => s.setEditingHighlightsForFrame);
  const toggleFrameHighlightIds = useDiagramStore((s) => s.toggleFrameHighlightIds);
  const setHover = useDiagramStore((s) => s.setHover);
  const selected = useDiagramStore((s) => s.selected);
  const select = useDiagramStore((s) => s.select);
  const multiSelectedNodeIds = useDiagramStore((s) => s.multiSelectedNodeIds);
  const setMultiSelectedNodeIds = useDiagramStore((s) => s.setMultiSelectedNodeIds);
  const multiSelectedEdgeIds = useDiagramStore((s) => s.multiSelectedEdgeIds);
  const setMultiSelectedEdgeIds = useDiagramStore((s) => s.setMultiSelectedEdgeIds);
  const toggleMultiSelectedEdge = useDiagramStore((s) => s.toggleMultiSelectedEdge);
  const updateNode = useDiagramStore((s) => s.updateNode);
  const addNode = useDiagramStore((s) => s.addNode);
  const deleteNode = useDiagramStore((s) => s.deleteNode);
  const updateEdge = useDiagramStore((s) => s.updateEdge);
  const deleteEdge = useDiagramStore((s) => s.deleteEdge);
  const setDraggedNodeId = useDiagramStore((s) => s.setDraggedNodeId);

  const [pending, setPending] = useState<PendingConnection | null>(null);
  const [paneMenu, setPaneMenu] = useState<{ screenX: number; screenY: number } | null>(null);

  const currentFrame = diagram.frames.find((f) => f.id === currentFrameId) ?? null;
  const editingFrame = diagram.frames.find((f) => f.id === editingHighlightsForFrameId) ?? null;

  const effectiveGraph = useMemo(
    () =>
      computeEffectiveGraph(diagram, {
        activeSets,
        expandedNodes,
        hoverTarget,
        // While authoring a frame's highlights, show THAT frame's current
        // (live-updating as you click) membership instead of whatever
        // frame is actually playing — same field, different source.
        frameHighlighted: editingFrame ? (editingFrame.highlighted ?? []) : (currentFrame?.highlighted ?? null),
      }),
    [diagram, activeSets, expandedNodes, hoverTarget, currentFrame, editingFrame],
  );

  const sizes = useMemo(() => computeContainerSizes(effectiveGraph.visibleNodes), [effectiveGraph.visibleNodes]);
  const orderedNodes = useMemo(() => topoSort(effectiveGraph.visibleNodes), [effectiveGraph.visibleNodes]);

  // Position overrides for children of an auto-layout container (Figma-
  // style stacked row/column instead of freeform placement). Only the
  // node actually being dragged (see draggedNodeId below) is excluded
  // from getting an override — it renders at its own raw, live-updating
  // (cursor-following) position for the duration of the drag — while
  // every OTHER node, auto-layout or not, keeps rendering at its normal
  // computed position throughout. Suppressing the override for *every*
  // node whenever *any* drag was active (the previous approach) meant
  // every auto-layout child in the whole diagram would snap to its
  // stale stored `position` — never kept in sync while auto-layout is
  // what's actually been positioning it — the instant any drag started
  // anywhere, which is exactly what looked like every position on
  // screen "randomizing". Still-visible siblings in the dragged node's
  // own container reflow live as its sort rank changes during the drag,
  // since it's still included as an input to their computed slots, just
  // not given one of its own.
  const draggedNodeId = useDiagramStore((s) => s.draggedNodeId);
  const autoLayoutPositions = useMemo(
    () => computeAutoLayoutPositions(effectiveGraph.visibleNodes, sizes, draggedNodeId ?? undefined),
    [effectiveGraph.visibleNodes, sizes, draggedNodeId],
  );
  const positionOf = useCallback((n: EffectiveNode) => autoLayoutPositions.get(n.id) ?? n.position, [autoLayoutPositions]);

  // Persists every computed auto-layout slot back into the diagram's own
  // stored node positions, instead of leaving them as a purely visual,
  // render-time-only override — so a node's stored position is never
  // stale relative to where it's actually drawn. Two things fall out of
  // that for free: toggling auto-layout off leaves every child exactly
  // where it last visually sat (free one-shot alignment, then back to
  // manual placement) rather than snapping to some older stored value,
  // and dragging a node no longer has a stale position to snap back to
  // once released. Runs whenever the computed slots actually change —
  // the container's own layout mode is toggled, a child is added,
  // removed, resized, or reordered — and skips whichever node is
  // *currently* being dragged, since onNodeDrag is already keeping that
  // one's stored position live via the cursor; its own slot gets synced
  // the instant the drag stops and this effect sees it excluded no more.
  useEffect(() => {
    for (const [id, pos] of autoLayoutPositions) {
      if (id === draggedNodeId) continue;
      const node = diagram.nodes.find((n) => n.id === id);
      if (node && (node.position.x !== pos.x || node.position.y !== pos.y)) {
        updateNode(id, { position: pos });
      }
    }
  }, [autoLayoutPositions, draggedNodeId, diagram.nodes, updateNode]);

  // Absolute (canvas-space) position of every visible node, resolved by
  // walking down from each root — nested nodes' own `position` is only
  // relative to whatever container currently holds them. Needed to place
  // an actor-anchor at an action edge's real midpoint below, since that
  // math can't be expressed in either endpoint's local coordinate space.
  const absolutePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const n of orderedNodes) {
      const parentAbs = n.parentId ? map.get(n.parentId) : undefined;
      const pos = positionOf(n);
      map.set(n.id, { x: (parentAbs?.x ?? 0) + pos.x, y: (parentAbs?.y ?? 0) + pos.y });
    }
    return map;
  }, [orderedNodes, positionOf]);

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
          // reparent-on-drop logic below can detect the drag leaving (or
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
  // performs more than one action in the diagram. Position is derived
  // live from the current render, never stored.
  const actorAnchors: GraphNodeType[] = useMemo(() => {
    const anchors: GraphNodeType[] = [];
    for (const e of effectiveGraph.visibleEdges) {
      if (e.count !== 1 || !e.actorId) continue;
      const actor = diagram.nodes.find((n) => n.id === e.actorId);
      if (!actor) continue;
      const sourcePos = absolutePositions.get(e.visibleSourceId);
      const targetPos = absolutePositions.get(e.visibleTargetId);
      const sourceSize = sizes.get(e.visibleSourceId) ?? LEAF_SIZE;
      const targetSize = sizes.get(e.visibleTargetId) ?? LEAF_SIZE;
      if (!sourcePos || !targetPos) continue;

      const midX = (sourcePos.x + sourceSize.width / 2 + targetPos.x + targetSize.width / 2) / 2;
      const midY = (sourcePos.y + sourceSize.height / 2 + targetPos.y + targetSize.height / 2) / 2;
      const resolvedIconKey =
        actor.icon === null ? null : (actor.icon ?? guessIconKey(actor.label, Object.values(actor.metadata)));

      const data: EffectiveNode = {
        id: anchorIdFor(e.originalEdgeIds[0]),
        label: actor.label,
        renderMode: 'actor-anchor',
        position: { x: midX - ANCHOR_SIZE / 2, y: midY - ANCHOR_SIZE / 2 },
        metadata: {},
        color: actor.color,
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

  const onNodeDragStart: OnNodeDrag<GraphNodeType> = useCallback(
    (_event, node) => {
      setDraggedNodeId(node.id);
    },
    [setDraggedNodeId],
  );

  // We render nodes as a fully controlled prop (no onNodesChange wired up),
  // so React Flow has no mechanism of its own to move a node on screen
  // during a drag — it only computes the final position for
  // onNodeDragStop. Feeding the position back on every tick via onNodeDrag
  // is what makes the node actually track the cursor instead of jumping to
  // its destination only once the pointer is released.
  const onNodeDrag: OnNodeDrag<GraphNodeType> = useCallback(
    (_event, node) => {
      updateNode(node.id, { position: node.position });
    },
    [updateNode],
  );

  const { getInternalNode, screenToFlowPosition } = useReactFlow<GraphNodeType, GraphEdgeType>();

  // Dropping a node inside an expanded container's box reparents it there;
  // dropping a currently-nested node outside every container un-parents it
  // back to the root. Both directions need each node's ABSOLUTE canvas
  // position (not the position prop, which is relative to whatever parent
  // it has *right now*) — React Flow already computes that internally for
  // rendering, so we read it via getInternalNode rather than re-deriving
  // the parent-chain math ourselves.
  const onNodeDragStop: OnNodeDrag<GraphNodeType> = useCallback(
    (_event, node) => {
      setDraggedNodeId(null);

      const draggedInternal = getInternalNode(node.id);
      if (!draggedInternal) {
        updateNode(node.id, { position: node.position });
        return;
      }
      const draggedAbs = draggedInternal.internals.positionAbsolute;
      // `sizes` (computeContainerSizes, already used for every node's style
      // width/height above) rather than RF's own `measured` field: a
      // container's DOM box is only measured once React Flow's
      // ResizeObserver has actually fired on it, which briefly leaves
      // `measured` at {width:0, height:0} right after expanding — exactly
      // when a drag-to-reparent into it is most likely to happen. `sizes`
      // is synchronously authoritative since we compute it ourselves.
      const draggedSize = sizes.get(node.id);
      const draggedCenter = {
        x: draggedAbs.x + (draggedSize?.width ?? 0) / 2,
        y: draggedAbs.y + (draggedSize?.height ?? 0) / 2,
      };

      const ancestry = buildAncestryIndex(diagram);
      let best: { id: string; area: number } | null = null;
      for (const n of effectiveGraph.visibleNodes) {
        if (n.renderMode !== 'expanded-container' || n.id === node.id) continue;
        // Reparenting into one of the dragged node's own descendants would
        // create a cycle — skip those candidates entirely.
        if (isAncestor(ancestry, node.id, n.id)) continue;
        const containerInternal = getInternalNode(n.id);
        if (!containerInternal) continue;
        const pos = containerInternal.internals.positionAbsolute;
        const containerSize = sizes.get(n.id);
        const w = containerSize?.width ?? 0;
        const h = containerSize?.height ?? 0;
        const within =
          draggedCenter.x >= pos.x &&
          draggedCenter.x <= pos.x + w &&
          draggedCenter.y >= pos.y &&
          draggedCenter.y <= pos.y + h;
        if (!within) continue;
        const area = w * h;
        // Nested containers can both contain the drop point; prefer the
        // smallest (most specific/innermost) one.
        if (!best || area < best.area) best = { id: n.id, area };
      }

      const currentParentId = diagram.nodes.find((n) => n.id === node.id)?.parentId;
      const targetParentId = best?.id;

      if (targetParentId && targetParentId !== currentParentId) {
        const containerInternal = getInternalNode(targetParentId)!;
        const containerAbs = containerInternal.internals.positionAbsolute;
        updateNode(node.id, {
          parentId: targetParentId,
          position: { x: draggedAbs.x - containerAbs.x, y: draggedAbs.y - containerAbs.y },
        });
      } else if (!targetParentId && currentParentId) {
        updateNode(node.id, { parentId: undefined, position: draggedAbs });
      } else {
        updateNode(node.id, { position: node.position });
      }
    },
    [updateNode, setDraggedNodeId, getInternalNode, diagram, effectiveGraph.visibleNodes, sizes],
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (!connectionState.isValid || !connectionState.fromNode || !connectionState.toNode) return;
      const sourceId = connectionState.fromNode.id;
      const targetId = connectionState.toNode.id;
      if (sourceId === targetId) return;
      const point = 'changedTouches' in event ? event.changedTouches[0] : (event as MouseEvent);
      setPending({
        sourceId,
        targetId,
        screenX: point.clientX,
        screenY: point.clientY,
        // Position's string values ('top'/'right'/'bottom'/'left') already
        // match our handle-id convention, so the exact side dragged
        // from/to carries straight through to the new edge.
        sourceHandle: connectionState.fromPosition as 'top' | 'right' | 'bottom' | 'left' | undefined,
        targetHandle: connectionState.toPosition as 'top' | 'right' | 'bottom' | 'left' | undefined,
      });
    },
    [],
  );

  // Dragging an existing (reconnectable, see rfEdges above) edge's own
  // endpoint onto a different node/anchor reassigns it in place instead
  // of forcing a delete-and-recreate — how a misattributed trigger gets
  // pointed at the right action's anchor, or any edge gets re-aimed. The
  // no-op guard matters specifically for a substituted endpoint (edge
  // rendered against a collapsed ancestor): dropping back without
  // actually moving it would otherwise fire with the SAME
  // source/target the edge already rendered with (the collapsed
  // ancestor's id) and silently overwrite the raw edge's real child
  // endpoint with that ancestor's id — only write when something
  // actually changed.
  const onReconnect: OnReconnect<GraphEdgeType> = useCallback(
    (oldEdge, newConnection) => {
      if (!oldEdge.data || oldEdge.data.count !== 1) return;
      if (!newConnection.source || !newConnection.target) return;
      if (newConnection.source === oldEdge.source && newConnection.target === oldEdge.target) return;
      const rawEdgeId = oldEdge.data.originalEdgeIds[0];
      updateEdge(rawEdgeId, {
        sourceId: newConnection.source,
        targetId: newConnection.target,
        sourceHandle: (newConnection.sourceHandle ?? undefined) as 'top' | 'right' | 'bottom' | 'left' | undefined,
        targetHandle: (newConnection.targetHandle ?? undefined) as 'top' | 'right' | 'bottom' | 'left' | undefined,
      });
    },
    [updateEdge],
  );

  const onNodeClick: NodeMouseHandler<GraphNodeType> = useCallback(() => {
    // selection handled in GraphNode via stopPropagation; this keeps RF's
    // own selection state (border highlight) in sync.
  }, []);

  // Clicking anywhere along an edge's path (not just the small label chip
  // near its midpoint, which GraphEdge also handles for its own reasons —
  // hover/context-menu — but is easy to miss on a long or label-less
  // edge) selects it too — or, while authoring a frame's highlights,
  // toggles every raw edge behind this line's membership in that frame
  // instead (see toggleFrameHighlightIds).
  const onEdgeClick: EdgeMouseHandler<GraphEdgeType> = useCallback(
    (event, edge) => {
      if (editingHighlightsForFrameId && edge.data) {
        toggleFrameHighlightIds(editingHighlightsForFrameId, edge.data.originalEdgeIds);
        return;
      }
      // Shift/Cmd/Ctrl-click toggles this edge into the multi-selection
      // instead of replacing the current selection — the reliable way to
      // select several edges (see toggleMultiSelectedEdge).
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        toggleMultiSelectedEdge(edge.id);
        return;
      }
      select({ kind: 'edge', id: edge.id });
    },
    [select, editingHighlightsForFrameId, toggleFrameHighlightIds, toggleMultiSelectedEdge],
  );

  const onPaneClick = useCallback(() => {
    select(null);
    setHover(null);
    setMultiSelectedNodeIds(new Set());
    setMultiSelectedEdgeIds(new Set());
    setPaneMenu(null);
  }, [select, setHover, setMultiSelectedNodeIds, setMultiSelectedEdgeIds]);

  // React Flow only calls this for a right-click on empty canvas — clicks
  // on a node/edge go to their own onNodeContextMenu/onEdgeContextMenu
  // instead, so there's no risk of this colliding with GraphNode/GraphEdge's
  // own per-element context menus the way nesting a shadcn ContextMenu
  // around the whole canvas would (Radix's trigger doesn't stop the
  // contextmenu event from bubbling, so an outer + inner ContextMenu would
  // both try to open).
  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    setPaneMenu({ screenX: event.clientX, screenY: event.clientY });
  }, []);

  const handleAddNodeFromPaneMenu = useCallback(() => {
    if (!paneMenu) return;
    const position = screenToFlowPosition({ x: paneMenu.screenX, y: paneMenu.screenY });
    const id = addNode({ label: 'New node', position, metadata: {} });
    select({ kind: 'node', id });
    setPaneMenu(null);
  }, [paneMenu, screenToFlowPosition, addNode, select]);

  // Figma's "wrap selection in frame": a new container appears around the
  // exact current bounding box of the selection (nothing moves visually),
  // and every selected node reparents into it, keeping its own absolute
  // position unchanged — only the coordinate space it's expressed in
  // shifts, from whatever ancestor it had before to the new container.
  // The new container's own parent is the selection's one shared parent,
  // or the root if the selection spans more than one (mixed-depth
  // selections all promote to a single new top-level frame together).
  const handleWrapInContainer = useCallback(() => {
    const ids = [...multiSelectedNodeIds];
    if (ids.length < 2) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of ids) {
      const abs = absolutePositions.get(id);
      const size = sizes.get(id);
      if (!abs || !size) continue;
      minX = Math.min(minX, abs.x);
      minY = Math.min(minY, abs.y);
      maxX = Math.max(maxX, abs.x + size.width);
      maxY = Math.max(maxY, abs.y + size.height);
    }
    if (!Number.isFinite(minX)) return;

    const parentIds = new Set(ids.map((id) => diagram.nodes.find((n) => n.id === id)?.parentId));
    const newParentId = parentIds.size === 1 ? [...parentIds][0] : undefined;
    const newParentAbs = (newParentId && absolutePositions.get(newParentId)) || { x: 0, y: 0 };
    const containerAbs = { x: minX - CONTAINER_PADDING, y: minY - CONTAINER_HEADER_HEIGHT };

    const containerId = addNode({
      label: 'New container',
      parentId: newParentId,
      position: { x: containerAbs.x - newParentAbs.x, y: containerAbs.y - newParentAbs.y },
      metadata: {},
    });

    for (const id of ids) {
      const abs = absolutePositions.get(id);
      if (!abs) continue;
      updateNode(id, { parentId: containerId, position: { x: abs.x - containerAbs.x, y: abs.y - containerAbs.y } });
    }

    if (newParentId && !expandedNodes.has(newParentId)) expandNodes([newParentId, containerId]);
    else expandNodes([containerId]);
    setMultiSelectedNodeIds(new Set());
    select({ kind: 'node', id: containerId });
  }, [multiSelectedNodeIds, absolutePositions, sizes, diagram.nodes, addNode, updateNode, expandedNodes, expandNodes, setMultiSelectedNodeIds, select]);

  // Applies the same fixed-vs-floating anchor logic EdgePropertiesPanel
  // uses for one edge (see its toggleAnchor) to every selected edge at
  // once — a deterministic "make them all curvy" / "make them all
  // floating" rather than a per-edge toggle, since a mixed starting state
  // would otherwise make "toggle" produce a confusing, no-longer-uniform
  // result. Silently skips any selected edge that's still merged (count >
  // 1) — same "expand to edit" constraint as everywhere else.
  const handleBulkAnchor = useCallback(
    (makeCurvy: boolean) => {
      for (const edgeId of multiSelectedEdgeIds) {
        const effEdge = effectiveGraph.visibleEdges.find((e) => e.id === edgeId);
        if (!effEdge || effEdge.count !== 1) continue;
        const rawEdgeId = effEdge.originalEdgeIds[0];
        if (!makeCurvy) {
          updateEdge(rawEdgeId, { sourceHandle: undefined, targetHandle: undefined });
          continue;
        }
        const sourceInternal = getInternalNode(effEdge.visibleSourceId);
        const targetInternal = getInternalNode(effEdge.visibleTargetId);
        if (!sourceInternal || !targetInternal) continue;
        const { sourcePos, targetPos } = getFloatingEdgeParams(sourceInternal, targetInternal);
        updateEdge(rawEdgeId, { sourceHandle: sourcePos, targetHandle: targetPos });
      }
    },
    [multiSelectedEdgeIds, effectiveGraph.visibleEdges, updateEdge, getInternalNode],
  );

  const handleBulkDeleteNodes = useCallback(() => {
    for (const id of multiSelectedNodeIds) deleteNode(id);
    setMultiSelectedNodeIds(new Set());
  }, [multiSelectedNodeIds, deleteNode, setMultiSelectedNodeIds]);

  const handleBulkDeleteEdges = useCallback(() => {
    for (const edgeId of multiSelectedEdgeIds) {
      const effEdge = effectiveGraph.visibleEdges.find((e) => e.id === edgeId);
      if (effEdge && effEdge.count === 1) deleteEdge(effEdge.originalEdgeIds[0]);
    }
    setMultiSelectedEdgeIds(new Set());
  }, [multiSelectedEdgeIds, effectiveGraph.visibleEdges, deleteEdge, setMultiSelectedEdgeIds]);

  // Marquee (shift-drag) box-select reports its result here — this is the
  // other half of feeding `selected` back into rfNodes/rfEdges above.
  // Without capturing it, the selection rectangle draws but nothing is
  // ever recorded as selected. A box can cover both nodes and edges at
  // once, so both halves of RF's own report get captured, not just nodes.
  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes, edges }) => {
      setMultiSelectedNodeIds(new Set(nodes.map((n) => n.id)));
      setMultiSelectedEdgeIds(new Set(edges.map((e) => e.id)));
    },
    [setMultiSelectedNodeIds, setMultiSelectedEdgeIds],
  );

  // React Flow decides this list from its OWN internal selection tracking,
  // which can momentarily disagree with our store (e.g. a right-click can
  // mark a node selected inside RF before the context-menu action's
  // select()/duplicateNode() call has propagated back through the
  // controlled `selected` prop on the next render) — deleting a stale
  // node alongside the intended one, as happened when duplicating then
  // immediately deleting the copy also silently deleted the original. Our
  // store's `selected`/`multiSelectedNodeIds` is the single source of
  // truth, so filter RF's list down to it. Reading via getState() rather
  // than the hook-selected values above matters here: RF can invoke this
  // callback with a reference captured before a just-dispatched store
  // update has flowed back through React's render cycle, so a
  // useCallback-memoized closure over `selected`/`multiSelectedNodeIds`
  // can itself be one render stale. getState() always returns the
  // absolute latest store snapshot regardless of React's render timing.
  const onNodesDelete = useCallback(
    (nodes: GraphNodeType[]) => {
      const { selected: currentSelected, multiSelectedNodeIds: currentMulti } = useDiagramStore.getState();
      for (const n of nodes) {
        if (currentMulti.has(n.id) || (currentSelected?.kind === 'node' && currentSelected.id === n.id)) {
          deleteNode(n.id);
        }
      }
    },
    [deleteNode],
  );

  const onEdgesDelete = useCallback(
    (edges: GraphEdgeType[]) => {
      const { selected: currentSelected, multiSelectedEdgeIds: currentMulti } = useDiagramStore.getState();
      for (const e of edges) {
        // Same RF-vs-store desync guard as onNodesDelete above, plus the
        // existing constraint that only unambiguous (unmerged) edges can
        // be deleted directly.
        const isSelected = currentMulti.has(e.id) || (currentSelected?.kind === 'edge' && currentSelected.id === e.id);
        if (isSelected && e.data && e.data.count === 1) {
          deleteEdge(e.data.originalEdgeIds[0]);
        }
      }
    },
    [deleteEdge],
  );

  return (
    <div className="diagram-canvas h-full w-full">
      {/* Shared arrowhead marker for every edge. `context-stroke` makes it
          inherit each edge's own stroke color, so one definition covers
          every lens color without generating a marker per color. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <marker
            id="graph-edge-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: 'context-stroke' }} />
          </marker>
        </defs>
      </svg>
      <ReactFlow
        nodes={allRfNodes}
        edges={visibleRfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnectEnd={onConnectEnd}
        onReconnect={onReconnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onSelectionChange={onSelectionChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        deleteKeyCode={['Backspace', 'Delete']}
        minZoom={0.2}
        maxZoom={2}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
      {editingFrame && (
        <div className="pointer-events-none absolute top-2.5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md">
          <span>
            Editing highlights for <strong>{editingFrame.name}</strong> — click nodes/edges to toggle
          </span>
          <button
            className="pointer-events-auto cursor-pointer rounded-full border-none bg-primary px-2 py-0.5 text-primary-foreground"
            onClick={() => setEditingHighlightsForFrame(null)}
          >
            Done
          </button>
        </div>
      )}
      {!editingFrame && multiSelectedNodeIds.size > 1 && (
        <div className="pointer-events-none absolute top-2.5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md">
          <span>{multiSelectedNodeIds.size} nodes selected</span>
          <button
            className="pointer-events-auto cursor-pointer rounded-full border-none bg-primary px-2 py-0.5 text-primary-foreground"
            onClick={handleWrapInContainer}
          >
            Wrap in container
          </button>
          <button
            className="pointer-events-auto cursor-pointer rounded-full border-none bg-destructive px-2 py-0.5 text-white"
            onClick={handleBulkDeleteNodes}
          >
            Delete
          </button>
        </div>
      )}
      {!editingFrame && multiSelectedEdgeIds.size > 1 && (
        <div
          className="pointer-events-none absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{ top: multiSelectedNodeIds.size > 1 ? 44 : 10 }}
        >
          <span>{multiSelectedEdgeIds.size} edges selected</span>
          <button
            className="pointer-events-auto cursor-pointer rounded-full border-none bg-primary px-2 py-0.5 text-primary-foreground"
            onClick={() => handleBulkAnchor(true)}
          >
            Make curvy
          </button>
          <button
            className="pointer-events-auto cursor-pointer rounded-full border border-input bg-transparent px-2 py-0.5 text-foreground"
            onClick={() => handleBulkAnchor(false)}
          >
            Make floating
          </button>
          <button
            className="pointer-events-auto cursor-pointer rounded-full border-none bg-destructive px-2 py-0.5 text-white"
            onClick={handleBulkDeleteEdges}
          >
            Delete
          </button>
        </div>
      )}
      {pending && <ConnectionPopover pending={pending} onDone={() => setPending(null)} />}
      {paneMenu && (
        <PaneContextMenu
          screenX={paneMenu.screenX}
          screenY={paneMenu.screenY}
          onAddNode={handleAddNodeFromPaneMenu}
          onClose={() => setPaneMenu(null)}
        />
      )}
    </div>
  );
}
