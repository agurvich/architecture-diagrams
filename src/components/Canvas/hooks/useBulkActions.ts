import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useDiagramStore } from '../../../store/diagramStore';
import { CONTAINER_HEADER_HEIGHT, CONTAINER_PADDING, type Size } from '../../../engine/containerLayout';
import { getFloatingEdgeParams } from '../floatingEdgeUtils';
import type { Diagram } from '../../../types/diagram';
import type { EffectiveEdge } from '../../../types/effectiveGraph';
import type { GraphNodeType } from '../GraphNode';
import type { GraphEdgeType } from '../GraphEdge';

interface Params {
  diagram: Diagram;
  visibleEdges: EffectiveEdge[];
  absolutePositions: Map<string, { x: number; y: number }>;
  sizes: Map<string, Size>;
  /**
   * When set, `absolutePositions` reflects node-lens region slots rather
   * than the real structural tree (see engine/nodeLens.ts) — every node's
   * ancestor chain passes through at least one lens-detached bundle root
   * whenever a lens is active (a top-level node is always its own bundle
   * root), so there's no subset of the canvas position math stays safe
   * for. handleWrapInContainer refuses to run in that case: writing those
   * positions into the diagram's real, persisted state would look fine
   * while the lens stays on and then be garbled the moment it turns off.
   */
  nodeLensKey: string | null;
}

/** The floating action-bar operations available once 2+ nodes or edges are multi-selected. */
export function useBulkActions({ diagram, visibleEdges, absolutePositions, sizes, nodeLensKey }: Params) {
  const multiSelectedNodeIds = useDiagramStore((s) => s.multiSelectedNodeIds);
  const setMultiSelectedNodeIds = useDiagramStore((s) => s.setMultiSelectedNodeIds);
  const multiSelectedEdgeIds = useDiagramStore((s) => s.multiSelectedEdgeIds);
  const setMultiSelectedEdgeIds = useDiagramStore((s) => s.setMultiSelectedEdgeIds);
  const addNode = useDiagramStore((s) => s.addNode);
  const updateNode = useDiagramStore((s) => s.updateNode);
  const updateEdge = useDiagramStore((s) => s.updateEdge);
  const deleteNode = useDiagramStore((s) => s.deleteNode);
  const deleteEdge = useDiagramStore((s) => s.deleteEdge);
  const expandedNodes = useDiagramStore((s) => s.expandedNodes);
  const expandNodes = useDiagramStore((s) => s.expandNodes);
  const select = useDiagramStore((s) => s.select);
  const { getInternalNode } = useReactFlow<GraphNodeType, GraphEdgeType>();

  // Figma's "wrap selection in frame": a new container appears around the
  // exact current bounding box of the selection (nothing moves visually),
  // and every selected node reparents into it, keeping its own absolute
  // position unchanged — only the coordinate space it's expressed in
  // shifts, from whatever ancestor it had before to the new container.
  // The new container's own parent is the selection's one shared parent,
  // or the root if the selection spans more than one (mixed-depth
  // selections all promote to a single new top-level frame together).
  const handleWrapInContainer = useCallback(() => {
    if (nodeLensKey) return;
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
  }, [
    nodeLensKey,
    multiSelectedNodeIds,
    absolutePositions,
    sizes,
    diagram.nodes,
    addNode,
    updateNode,
    expandedNodes,
    expandNodes,
    setMultiSelectedNodeIds,
    select,
  ]);

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
        const effEdge = visibleEdges.find((e) => e.id === edgeId);
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
    [multiSelectedEdgeIds, visibleEdges, updateEdge, getInternalNode],
  );

  const handleBulkDeleteNodes = useCallback(() => {
    for (const id of multiSelectedNodeIds) deleteNode(id);
    setMultiSelectedNodeIds(new Set());
  }, [multiSelectedNodeIds, deleteNode, setMultiSelectedNodeIds]);

  const handleBulkDeleteEdges = useCallback(() => {
    for (const edgeId of multiSelectedEdgeIds) {
      const effEdge = visibleEdges.find((e) => e.id === edgeId);
      if (effEdge && effEdge.count === 1) deleteEdge(effEdge.originalEdgeIds[0]);
    }
    setMultiSelectedEdgeIds(new Set());
  }, [multiSelectedEdgeIds, visibleEdges, deleteEdge, setMultiSelectedEdgeIds]);

  return { handleWrapInContainer, handleBulkAnchor, handleBulkDeleteNodes, handleBulkDeleteEdges };
}
