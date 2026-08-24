import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  ConnectionMode,
  Controls,
  ReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type OnConnectEnd,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDiagramStore } from '../../store/diagramStore';
import { computeEffectiveGraph } from '../../engine/computeEffectiveGraph';
import type { EffectiveNode } from '../../types/effectiveGraph';
import { GraphNode, type GraphNodeType } from './GraphNode';
import { GraphEdge, type GraphEdgeType } from './GraphEdge';
import { ConnectionPopover, type PendingConnection } from './ConnectionPopover';

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
  const select = useDiagramStore((s) => s.select);
  const updateNode = useDiagramStore((s) => s.updateNode);
  const setNodeDragging = useDiagramStore((s) => s.setNodeDragging);

  const [pending, setPending] = useState<PendingConnection | null>(null);

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
          extent: n.parentId ? 'parent' : undefined,
          data: n,
          style: { width: size.width, height: size.height },
          draggable: true,
        };
        return node;
      }),
    [orderedNodes, sizes],
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

  const onNodeDragStop: OnNodeDrag<GraphNodeType> = useCallback(
    (_event, node) => {
      setNodeDragging(false);
      updateNode(node.id, { position: node.position });
    },
    [updateNode, setNodeDragging],
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
  }, [select, setHover]);

  return (
    <div className="diagram-canvas">
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
        minZoom={0.2}
        maxZoom={2}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
      {pending && <ConnectionPopover pending={pending} onDone={() => setPending(null)} />}
    </div>
  );
}
