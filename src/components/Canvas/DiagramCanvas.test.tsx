import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DiagramCanvas } from './DiagramCanvas';
import { useDiagramStore } from '../../store/diagramStore';

// Real marquee (shift-drag) selection is driven by React Flow's own
// internal pointer-drag recognition, which doesn't respond to
// JS-dispatched synthetic PointerEvents (confirmed by hand while building
// this) — so these set the resulting store state directly instead. That's
// the same state a completed marquee drag would have produced via
// onSelectionChange; what's under test here is what happens *after* that
// (the floating action bar's buttons), not the marquee gesture itself.
function setFlatDiagram() {
  useDiagramStore.getState().loadSeed();
  useDiagramStore.setState((state) => ({
    diagram: {
      ...state.diagram,
      nodes: [
        { id: 'a', label: 'A', position: { x: 0, y: 0 }, metadata: {} },
        { id: 'b', label: 'B', position: { x: 300, y: 0 }, metadata: {} },
        { id: 'c', label: 'C', position: { x: 600, y: 0 }, metadata: {} },
      ],
      edges: [
        { id: 'e1', sourceId: 'a', targetId: 'b', sets: [state.diagram.edgeSets[0].id], metadata: {} },
        { id: 'e2', sourceId: 'b', targetId: 'c', sets: [state.diagram.edgeSets[0].id], metadata: {} },
      ],
    },
    activeSets: new Set([state.diagram.edgeSets[0].id]),
    expandedNodes: new Set(),
    selected: null,
    multiSelectedNodeIds: new Set(),
    multiSelectedEdgeIds: new Set(),
  }));
}

describe('DiagramCanvas — group-select bulk actions', () => {
  beforeEach(() => {
    setFlatDiagram();
  });

  it('shows a "Wrap in container" action once 2+ nodes are multi-selected, and it reparents them into a new container while preserving their absolute positions', async () => {
    const user = userEvent.setup();
    render(
      <ReactFlowProvider>
        <DiagramCanvas />
      </ReactFlowProvider>,
    );

    useDiagramStore.getState().setMultiSelectedNodeIds(new Set(['a', 'b']));

    const button = await screen.findByRole('button', { name: /wrap in container/i });
    await user.click(button);

    const nodes = useDiagramStore.getState().diagram.nodes;
    const container = nodes.find((n) => !['a', 'b', 'c'].includes(n.id))!;
    expect(container).toBeDefined();

    const a = nodes.find((n) => n.id === 'a')!;
    const b = nodes.find((n) => n.id === 'b')!;
    expect(a.parentId).toBe(container.id);
    expect(b.parentId).toBe(container.id);
    // Absolute position preserved: a was at (0,0) top-level, so its new
    // position (relative to the container) plus the container's own
    // position should still land back on (0,0).
    expect(container.position.x + a.position.x).toBe(0);
    expect(container.position.y + a.position.y).toBe(0);
    expect(container.position.x + b.position.x).toBe(300);
    expect(container.position.y + b.position.y).toBe(0);

    // c wasn't selected — untouched, still top-level.
    expect(nodes.find((n) => n.id === 'c')!.parentId).toBeUndefined();
  });

  it('shows "Make curvy"/"Make floating" once 2+ edges are multi-selected, and each applies to every selected edge at once', async () => {
    const user = userEvent.setup();
    render(
      <ReactFlowProvider>
        <DiagramCanvas />
      </ReactFlowProvider>,
    );

    useDiagramStore.getState().setMultiSelectedEdgeIds(new Set(['merged:a=>b', 'merged:b=>c']));

    const curvyButton = await screen.findByRole('button', { name: /make curvy/i });
    await user.click(curvyButton);

    let edges = useDiagramStore.getState().diagram.edges;
    for (const id of ['e1', 'e2']) {
      const e = edges.find((x) => x.id === id)!;
      expect(e.sourceHandle).toBeDefined();
      expect(e.targetHandle).toBeDefined();
    }

    const floatingButton = await screen.findByRole('button', { name: /make floating/i });
    await user.click(floatingButton);

    edges = useDiagramStore.getState().diagram.edges;
    for (const id of ['e1', 'e2']) {
      const e = edges.find((x) => x.id === id)!;
      expect(e.sourceHandle).toBeUndefined();
      expect(e.targetHandle).toBeUndefined();
    }
  });

  it('does not show either action bar for a single selection', () => {
    render(
      <ReactFlowProvider>
        <DiagramCanvas />
      </ReactFlowProvider>,
    );
    useDiagramStore.getState().setMultiSelectedNodeIds(new Set(['a']));
    expect(screen.queryByRole('button', { name: /wrap in container/i })).toBeNull();
  });

  // React Flow doesn't resolve edge geometry (and so never renders any
  // <g data-testid="rf__edge-...">) under jsdom — there's no real layout
  // engine to report handle positions from, even with the ResizeObserver
  // stub — so shift-click-to-toggle is verified at the store level
  // (toggleMultiSelectedEdge, in diagramStore.test.ts) and by hand in a
  // real browser instead of through a rendered edge element here.
});
