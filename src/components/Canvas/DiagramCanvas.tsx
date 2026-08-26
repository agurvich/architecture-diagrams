import { Background, ConnectionMode, Controls, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDiagramStore } from '../../store/diagramStore';
import { useEffectiveRenderGraph } from './hooks/useEffectiveRenderGraph';
import { useCanvasNodesAndEdges } from './hooks/useCanvasNodesAndEdges';
import { useNodeDragAndReparent } from './hooks/useNodeDragAndReparent';
import { useEdgeConnections } from './hooks/useEdgeConnections';
import { useBulkActions } from './hooks/useBulkActions';
import { useCanvasSelection } from './hooks/useCanvasSelection';
import { GraphNode } from './GraphNode';
import { GraphEdge } from './GraphEdge';
import { ConnectionPopover } from './ConnectionPopover';
import { PaneContextMenu } from './PaneContextMenu';

const nodeTypes = { graphNode: GraphNode };
const edgeTypes = { graphEdge: GraphEdge };

export function DiagramCanvas() {
  const setEditingHighlightsForFrame = useDiagramStore((s) => s.setEditingHighlightsForFrame);
  const multiSelectedNodeIds = useDiagramStore((s) => s.multiSelectedNodeIds);
  const multiSelectedEdgeIds = useDiagramStore((s) => s.multiSelectedEdgeIds);

  const { diagram, effectiveGraph, sizes, orderedNodes, positionOf, absolutePositions, editingFrame } =
    useEffectiveRenderGraph();

  const { allRfNodes, visibleRfEdges } = useCanvasNodesAndEdges({
    diagram,
    effectiveGraph,
    orderedNodes,
    sizes,
    positionOf,
    absolutePositions,
  });

  const { onNodeDragStart, onNodeDrag, onNodeDragStop } = useNodeDragAndReparent({
    diagram,
    visibleNodes: effectiveGraph.visibleNodes,
    sizes,
  });

  const { pending, setPending, onConnectStart, onConnectEnd, onReconnect, onReconnectStart, onReconnectEnd } =
    useEdgeConnections();

  const { handleWrapInContainer, handleBulkAnchor, handleBulkDeleteNodes, handleBulkDeleteEdges } = useBulkActions({
    diagram,
    visibleEdges: effectiveGraph.visibleEdges,
    absolutePositions,
    sizes,
  });

  const {
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
  } = useCanvasSelection();

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
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onReconnect={onReconnect}
        onReconnectStart={onReconnectStart}
        onReconnectEnd={onReconnectEnd}
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
