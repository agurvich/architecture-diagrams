import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  ConnectionMode,
  Controls,
  ReactFlow,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type OnConnectEnd,
  type OnNodeDrag,
  type OnSelectionChangeFunc,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDiagramStore } from '../../store/diagramStore';
import { computeEffectiveGraph } from '../../engine/computeEffectiveGraph';
import { buildAncestryIndex, isAncestor } from '../../engine/ancestry';
import type { EffectiveNode } from '../../types/effectiveGraph';
import { GraphNode, type GraphNodeType } from './GraphNode';
import { GraphEdge, type GraphEdgeType } from './GraphEdge';
import { ConnectionPopover, type PendingConnection } from './ConnectionPopover';
import { PaneContextMenu } from './PaneContextMenu';

const LEAF_SIZE = { width: 170, height: 64 };
const CONTAINER_PADDING = 20;
const CONTAINER_HEADER_HEIGHT = 34;

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
  const visibleNodesById = useMemo(
    () => new Map(effectiveGraph.visibleNodes.map((n) => [n.id, n])),
    [effectiveGraph.visibleNodes],
  );

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
          style: { width: size.width, height: size.height },
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
          data: e,
          selected: selected?.kind === 'edge' && selected.id === e.id,
        };
        return edge;
      }),
    [effectiveGraph.visibleEdges],
  );

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
      const targetEffNode = visibleNodesById.get(targetId);
      const defaultLevel = targetEffNode && targetEffNode.renderMode !== 'leaf' ? 'group' : 'node';
      const point = 'changedTouches' in event ? event.changedTouches[0] : (event as MouseEvent);
      setPending({ sourceId, targetId, screenX: point.clientX, screenY: point.clientY, defaultLevel });
    },
    [visibleNodesById],
  );

  const onNodeClick: NodeMouseHandler<GraphNodeType> = useCallback(() => {
    // selection handled in GraphNode via stopPropagation; this keeps RF's
    // own selection state (border highlight) in sync.
  }, []);

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
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnectEnd={onConnectEnd}
        onNodeClick={onNodeClick}
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
