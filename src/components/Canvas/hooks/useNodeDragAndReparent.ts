import { useCallback } from 'react';
import { useReactFlow, type OnNodeDrag } from '@xyflow/react';
import { useDiagramStore } from '../../../store/diagramStore';
import { buildAncestryIndex, isAncestor } from '../../../engine/ancestry';
import type { Size } from '../../../engine/containerLayout';
import type { Diagram } from '../../../types/diagram';
import type { EffectiveNode } from '../../../types/effectiveGraph';
import type { GraphNodeType } from '../GraphNode';
import type { GraphEdgeType } from '../GraphEdge';

interface Params {
  diagram: Diagram;
  visibleNodes: EffectiveNode[];
  sizes: Map<string, Size>;
}

/**
 * Node drag lifecycle: live position tracking during the drag, and — on
 * release — reparenting into (or out of) whichever expanded container the
 * node was dropped inside, using each node's ABSOLUTE canvas position
 * (React Flow's own internal resolution, not our own position prop, which
 * is only relative to whatever parent the node has *right now*).
 */
export function useNodeDragAndReparent({ diagram, visibleNodes, sizes }: Params) {
  const updateNode = useDiagramStore((s) => s.updateNode);
  const setDraggedNodeId = useDiagramStore((s) => s.setDraggedNodeId);
  const setHover = useDiagramStore((s) => s.setHover);
  const { getInternalNode } = useReactFlow<GraphNodeType, GraphEdgeType>();

  const onNodeDragStart: OnNodeDrag<GraphNodeType> = useCallback(
    (_event, node) => {
      setDraggedNodeId(node.id);
      // hoverFrozen (see GraphNode/GraphEdge) suppresses hover changes for
      // the entire drag so recomputing the effective graph mid-drag can't
      // corrupt React Flow's hit-testing — but that means whatever was
      // hovered the instant before the drag started would otherwise stay
      // dimming everything else on screen for the drag's whole duration,
      // surviving even past drop until the pointer happens to leave every
      // nested node and cross empty canvas. Clear it up front instead.
      setHover(null);
    },
    [setDraggedNodeId, setHover],
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

  // Dropping a node inside an expanded container's box reparents it there;
  // dropping a currently-nested node outside every container un-parents it
  // back to the root. Both directions need each node's ABSOLUTE canvas
  // position — React Flow already computes that internally for rendering,
  // so we read it via getInternalNode rather than re-deriving the
  // parent-chain math ourselves.
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
      // width/height) rather than RF's own `measured` field: a container's
      // DOM box is only measured once React Flow's ResizeObserver has
      // actually fired on it, which briefly leaves `measured` at
      // {width:0, height:0} right after expanding — exactly when a
      // drag-to-reparent into it is most likely to happen. `sizes` is
      // synchronously authoritative since we compute it ourselves.
      const draggedSize = sizes.get(node.id);
      const draggedCenter = {
        x: draggedAbs.x + (draggedSize?.width ?? 0) / 2,
        y: draggedAbs.y + (draggedSize?.height ?? 0) / 2,
      };

      const ancestry = buildAncestryIndex(diagram);
      let best: { id: string; area: number } | null = null;
      for (const n of visibleNodes) {
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
    [updateNode, setDraggedNodeId, getInternalNode, diagram, visibleNodes, sizes],
  );

  return { onNodeDragStart, onNodeDrag, onNodeDragStop };
}
