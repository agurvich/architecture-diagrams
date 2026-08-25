import { useCallback, useMemo, useState } from 'react';
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
import { guessIconKey } from '../../icons/iconMatcher';
import type { EffectiveNode } from '../../types/effectiveGraph';
import { GraphNode, type GraphNodeType } from './GraphNode';
import { GraphEdge, type GraphEdgeType } from './GraphEdge';
import { ConnectionPopover, type PendingConnection } from './ConnectionPopover';
import { PaneContextMenu } from './PaneContextMenu';

const LEAF_SIZE = { width: 170, height: 64 };
const CONTAINER_PADDING = 20;
const CONTAINER_HEADER_HEIGHT = 34;
const ANCHOR_SIZE = 26;

const nodeTypes = { graphNode: GraphNode };
const edgeTypes = { graphEdge: GraphEdge };

function computeContainerSizes(nodes: EffectiveNode[]): Map<string, { width: number; height: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, EffectiveNode[]>();
  for (const n of nodes) {
    if (n.parentId) {
      const list = childrenOf.get(n.parentId) ?? [];
      list.push(n);
      childrenOf.set(n.parentId, list);
    }
  }

  const sizeCache = new Map<string, { width: number; height: number }>();

  function sizeOf(id: string): { width: number; height: number } {
    const cached = sizeCache.get(id);
    if (cached) return cached;
    const node = byId.get(id);
    if (!node || node.renderMode !== 'expanded-container') {
      const size = LEAF_SIZE;
      sizeCache.set(id, size);
      return size;
    }
    const children = childrenOf.get(id) ?? [];
    if (children.length === 0) {
      sizeCache.set(id, LEAF_SIZE);
      return LEAF_SIZE;
    }
    let maxX = 0;
    let maxY = 0;
    for (const child of children) {
      const childSize = sizeOf(child.id);
      maxX = Math.max(maxX, child.position.x + childSize.width);
      maxY = Math.max(maxY, child.position.y + childSize.height);
    }
    const size = {
      width: maxX + CONTAINER_PADDING * 2,
      height: maxY + CONTAINER_PADDING + CONTAINER_HEADER_HEIGHT,
    };
    sizeCache.set(id, size);
    return size;
  }

  for (const n of nodes) sizeOf(n.id);
  return sizeCache;
}

function topoSort(nodes: EffectiveNode[]): EffectiveNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const ordered: EffectiveNode[] = [];

  function visit(node: EffectiveNode) {
    if (visited.has(node.id)) return;
    if (node.parentId && byId.has(node.parentId)) visit(byId.get(node.parentId)!);
    visited.add(node.id);
    ordered.push(node);
  }
  for (const n of nodes) visit(n);
  return ordered;
}

export function DiagramCanvas() {
  const diagram = useDiagramStore((s) => s.diagram);
  const activeSets = useDiagramStore((s) => s.activeSets);
  const expandedNodes = useDiagramStore((s) => s.expandedNodes);
  const hoverTarget = useDiagramStore((s) => s.hoverTarget);
  const currentFrameId = useDiagramStore((s) => s.currentFrameId);
  const setHover = useDiagramStore((s) => s.setHover);
  const selected = useDiagramStore((s) => s.selected);
  const select = useDiagramStore((s) => s.select);
  const multiSelectedNodeIds = useDiagramStore((s) => s.multiSelectedNodeIds);
  const setMultiSelectedNodeIds = useDiagramStore((s) => s.setMultiSelectedNodeIds);
  const updateNode = useDiagramStore((s) => s.updateNode);
  const addNode = useDiagramStore((s) => s.addNode);
  const deleteNode = useDiagramStore((s) => s.deleteNode);
  const updateEdge = useDiagramStore((s) => s.updateEdge);
  const deleteEdge = useDiagramStore((s) => s.deleteEdge);
  const setNodeDragging = useDiagramStore((s) => s.setNodeDragging);

  const [pending, setPending] = useState<PendingConnection | null>(null);
  const [paneMenu, setPaneMenu] = useState<{ screenX: number; screenY: number } | null>(null);

  const currentFrame = diagram.frames.find((f) => f.id === currentFrameId) ?? null;

  const effectiveGraph = useMemo(
    () =>
      computeEffectiveGraph(diagram, {
        activeSets,
        expandedNodes,
        hoverTarget,
        frameHighlighted: currentFrame?.highlighted ?? null,
      }),
    [diagram, activeSets, expandedNodes, hoverTarget, currentFrame],
  );

  const sizes = useMemo(() => computeContainerSizes(effectiveGraph.visibleNodes), [effectiveGraph.visibleNodes]);
  const orderedNodes = useMemo(() => topoSort(effectiveGraph.visibleNodes), [effectiveGraph.visibleNodes]);

  // Absolute (canvas-space) position of every visible node, resolved by
  // walking down from each root — nested nodes' own `position` is only
  // relative to whatever container currently holds them. Needed to place
  // an actor-anchor at an action edge's real midpoint below, since that
  // math can't be expressed in either endpoint's local coordinate space.
  const absolutePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const n of orderedNodes) {
      const parentAbs = n.parentId ? map.get(n.parentId) : undefined;
      map.set(n.id, { x: (parentAbs?.x ?? 0) + n.position.x, y: (parentAbs?.y ?? 0) + n.position.y });
    }
    return map;
  }, [orderedNodes]);

  const rfNodes: GraphNodeType[] = useMemo(
    () =>
      orderedNodes.map((n) => {
        const size = sizes.get(n.id)!;
        const node: Node<EffectiveNode, 'graphNode'> = {
          id: n.id,
          type: 'graphNode',
          position: n.position,
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
    [orderedNodes, sizes, multiSelectedNodeIds, selected],
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
          selected: selected?.kind === 'edge' && selected.id === e.id,
          // Draggable-to-reassign whenever it resolves to exactly one raw
          // edge — a collapsed ancestor standing in for the real endpoint
          // is a real node with its own handles, so there's always
          // exactly one raw record (originalEdgeIds[0]) to write the new
          // endpoint back to, substituted or not.
          reconnectable: e.count === 1,
        };
        return edge;
      }),
    [effectiveGraph.visibleEdges],
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

  const onNodeDragStart: OnNodeDrag<GraphNodeType> = useCallback(() => {
    setNodeDragging(true);
  }, [setNodeDragging]);

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
      setNodeDragging(false);

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
    [updateNode, setNodeDragging, getInternalNode, diagram, effectiveGraph.visibleNodes, sizes],
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
  // edge) selects it too.
  const onEdgeClick: EdgeMouseHandler<GraphEdgeType> = useCallback(
    (_event, edge) => {
      select({ kind: 'edge', id: edge.id });
    },
    [select],
  );

  const onPaneClick = useCallback(() => {
    select(null);
    setHover(null);
    setMultiSelectedNodeIds(new Set());
    setPaneMenu(null);
  }, [select, setHover, setMultiSelectedNodeIds]);

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

  // Marquee (shift-drag) box-select reports its result here — this is the
  // other half of feeding `selected` back into rfNodes above. Without
  // capturing it, the selection rectangle draws but nothing is ever
  // recorded as selected.
  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes }) => {
      setMultiSelectedNodeIds(new Set(nodes.map((n) => n.id)));
    },
    [setMultiSelectedNodeIds],
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
      const { selected: currentSelected } = useDiagramStore.getState();
      for (const e of edges) {
        // Same RF-vs-store desync guard as onNodesDelete above, plus the
        // existing constraint that only unambiguous (unmerged) edges can
        // be deleted directly.
        if (currentSelected?.kind === 'edge' && currentSelected.id === e.id && e.data && e.data.count === 1) {
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
