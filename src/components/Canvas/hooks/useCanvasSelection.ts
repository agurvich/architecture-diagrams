import { useCallback, useState } from 'react';
import { useReactFlow, type EdgeMouseHandler, type NodeMouseHandler, type OnSelectionChangeFunc } from '@xyflow/react';
import { useDiagramStore } from '../../../store/diagramStore';
import type { GraphNodeType } from '../GraphNode';
import type { GraphEdgeType } from '../GraphEdge';

/**
 * Click/selection/delete-key handling shared across the whole canvas:
 * node/edge/pane clicks, the right-click "Add node" pane menu, marquee
 * (shift-drag) box-select reporting, and Delete/Backspace.
 */
export function useCanvasSelection() {
  const editingHighlightsForFrameId = useDiagramStore((s) => s.editingHighlightsForFrameId);
  const toggleFrameHighlightIds = useDiagramStore((s) => s.toggleFrameHighlightIds);
  const toggleMultiSelectedEdge = useDiagramStore((s) => s.toggleMultiSelectedEdge);
  const select = useDiagramStore((s) => s.select);
  const setHover = useDiagramStore((s) => s.setHover);
  const setMultiSelectedNodeIds = useDiagramStore((s) => s.setMultiSelectedNodeIds);
  const setMultiSelectedEdgeIds = useDiagramStore((s) => s.setMultiSelectedEdgeIds);
  const deleteNode = useDiagramStore((s) => s.deleteNode);
  const deleteEdge = useDiagramStore((s) => s.deleteEdge);
  const addNode = useDiagramStore((s) => s.addNode);
  const { screenToFlowPosition } = useReactFlow<GraphNodeType, GraphEdgeType>();

  const [paneMenu, setPaneMenu] = useState<{ screenX: number; screenY: number } | null>(null);

  const onNodeClick: NodeMouseHandler<GraphNodeType> = useCallback(() => {
    // selection handled in GraphNode via stopPropagation; this keeps RF's
    // own selection state (border highlight) in sync.
  }, []);

  // Clicking anywhere along an edge's path (not just the small label chip
  // near its midpoint, which GraphEdge also handles for its own reasons —
  // hover/context-menu — but is easy to miss on a long or label-less
  // edge) selects it too — or, while authoring a frame's highlights,
  // toggles every raw edge behind this line's membership in that frame
  // instead.
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

  // Marquee (shift-drag) box-select reports its result here — this is the
  // other half of feeding `selected` back into rfNodes/rfEdges. Without
  // capturing it, the selection rectangle draws but nothing is ever
  // recorded as selected. A box can cover both nodes and edges at once,
  // so both halves of RF's own report get captured, not just nodes.
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

  return {
    paneMenu,
    setPaneMenu,
    onNodeClick,
    onEdgeClick,
    onPaneClick,
    onPaneContextMenu,
    handleAddNodeFromPaneMenu,
    onSelectionChange,
    onNodesDelete,
    onEdgesDelete,
  };
}
