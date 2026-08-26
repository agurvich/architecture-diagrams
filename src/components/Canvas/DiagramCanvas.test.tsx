import { render, screen, waitFor } from '@testing-library/react';
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

describe('DiagramCanvas — auto-layout position persistence', () => {
  function setAutoLayoutContainer() {
    useDiagramStore.getState().loadSeed();
    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        nodes: [
          {
            id: 'box',
            label: 'Box',
            position: { x: 0, y: 0 },
            metadata: {},
            autoLayout: { direction: 'vertical' as const, gap: 10 },
          },
          // Deliberately "wrong" — nowhere near where auto-layout will
          // actually place them; only their relative y order matters as
          // the sort key (child1 before child2).
          { id: 'child1', label: 'Child1', parentId: 'box', position: { x: 999, y: 0 }, metadata: {} },
          { id: 'child2', label: 'Child2', parentId: 'box', position: { x: -50, y: 500 }, metadata: {} },
        ],
        edges: [],
      },
      activeSets: new Set([state.diagram.edgeSets[0].id]),
      expandedNodes: new Set(['box']),
      selected: null,
      multiSelectedNodeIds: new Set(),
      multiSelectedEdgeIds: new Set(),
      draggedNodeId: null,
    }));
  }

  function positionsOf(ids: string[]) {
    const nodes = useDiagramStore.getState().diagram.nodes;
    return Object.fromEntries(ids.map((id) => [id, { ...nodes.find((n) => n.id === id)!.position }]));
  }

  it('syncs stored positions to the computed auto-layout slots on mount, not just the render override', async () => {
    setAutoLayoutContainer();
    render(
      <ReactFlowProvider>
        <DiagramCanvas />
      </ReactFlowProvider>,
    );

    await waitFor(() => {
      const { child1, child2 } = positionsOf(['child1', 'child2']);
      expect(child1).toEqual({ x: 20, y: 34 });
      expect(child2).toEqual({ x: 20, y: 108 }); // 34 + LEAF_SIZE.height(64) + gap(10)
    });
  });

  it('leaves positions frozen exactly where they last synced once auto-layout is turned off', async () => {
    setAutoLayoutContainer();
    render(
      <ReactFlowProvider>
        <DiagramCanvas />
      </ReactFlowProvider>,
    );
    await waitFor(() => {
      expect(positionsOf(['child1']).child1).toEqual({ x: 20, y: 34 });
    });

    useDiagramStore.getState().updateNode('box', { autoLayout: undefined });
    // Give any (incorrect, if present) further sync a chance to run, then
    // assert nothing moved — this is the "free alignment" the auto-layout
    // toggle is meant to leave behind.
    await new Promise((r) => setTimeout(r, 50));
    const { child1, child2 } = positionsOf(['child1', 'child2']);
    expect(child1).toEqual({ x: 20, y: 34 });
    expect(child2).toEqual({ x: 20, y: 108 });
  });

  it('does not overwrite the position of the node currently being dragged, but still syncs its siblings', async () => {
    setAutoLayoutContainer();
    render(
      <ReactFlowProvider>
        <DiagramCanvas />
      </ReactFlowProvider>,
    );
    await waitFor(() => {
      expect(positionsOf(['child1']).child1).toEqual({ x: 20, y: 34 });
    });

    // Simulate onNodeDragStart + a live drag tick: mark child1 as being
    // dragged, then move it somewhere arbitrary the way onNodeDrag would
    // — past child2 (a large y), so this also exercises drag-to-reorder.
    useDiagramStore.getState().setDraggedNodeId('child1');
    useDiagramStore.getState().updateNode('child1', { position: { x: 777, y: 777 } });
    await new Promise((r) => setTimeout(r, 50));
    expect(positionsOf(['child1']).child1).toEqual({ x: 777, y: 777 });
    // child2 wasn't excluded, so it already reflowed into the newly-first
    // slot while child1 (still dragging, further down) held the second.
    expect(positionsOf(['child2']).child2).toEqual({ x: 20, y: 34 });

    // Release: dropped past child2, so it settles into the second slot —
    // not back to its original position, a reorder actually took effect.
    useDiagramStore.getState().setDraggedNodeId(null);
    await waitFor(() => {
      expect(positionsOf(['child1']).child1).toEqual({ x: 20, y: 108 });
    });
  });
});

describe('DiagramCanvas — Delete/Backspace key', () => {
  // Unlike marquee drag (see the comment at the top of this file), the
  // Delete/Backspace key path doesn't need any real pointer geometry —
  // React Flow's deleteKeyCode listener just reads which of its own
  // nodes/edges are currently `selected: true` (driven straight off our
  // multiSelectedNodeIds/selected, see rfNodes/rfEdges above) and fires a
  // real keyboard event, so this exercises the actual code path instead
  // of calling the handler directly.
  beforeEach(() => {
    setFlatDiagram();
  });

  it('deletes every multi-selected node, leaving unselected ones untouched', async () => {
    const user = userEvent.setup();
    render(
      <ReactFlowProvider>
        <DiagramCanvas />
      </ReactFlowProvider>,
    );
    useDiagramStore.getState().setMultiSelectedNodeIds(new Set(['a', 'c']));

    await waitFor(() => {
      expect(document.querySelector('[data-id="a"]')?.className).toContain('selected');
    });
    await user.keyboard('{Delete}');

    const ids = useDiagramStore.getState().diagram.nodes.map((n) => n.id);
    expect(ids).not.toContain('a');
    expect(ids).not.toContain('c');
    expect(ids).toContain('b');
  });

  it('deletes a single selected (unmerged) edge', async () => {
    const user = userEvent.setup();
    render(
      <ReactFlowProvider>
        <DiagramCanvas />
      </ReactFlowProvider>,
    );
    // Edges never resolve real geometry/DOM under jsdom (no layout engine
    // to place them against — see the marquee-selection comment at the
    // top of this file), but deleteKeyCode reads selection off React
    // Flow's own internal edge state (driven straight from the `selected`
    // field on the edge objects we pass into <ReactFlow>), not the DOM —
    // so this still exercises the real path, just without a DOM check to
    // wait on first.
    useDiagramStore.getState().select({ kind: 'edge', id: 'merged:a=>b' });

    await user.keyboard('{Backspace}');

    const ids = useDiagramStore.getState().diagram.edges.map((e) => e.id);
    expect(ids).not.toContain('e1');
    expect(ids).toContain('e2');
  });

  it('does nothing when nothing is selected', async () => {
    const user = userEvent.setup();
    render(
      <ReactFlowProvider>
        <DiagramCanvas />
      </ReactFlowProvider>,
    );
    const before = useDiagramStore.getState().diagram;

    await user.keyboard('{Delete}');

    expect(useDiagramStore.getState().diagram.nodes).toEqual(before.nodes);
    expect(useDiagramStore.getState().diagram.edges).toEqual(before.edges);
  });
});

describe('DiagramCanvas — actor-anchor color inheritance', () => {
  it('an actor with no color of its own renders its anchor in its inherited (ancestor) color, not the default', async () => {
    useDiagramStore.getState().loadSeed();
    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        nodes: [
          { id: 'src', label: 'Src', position: { x: 0, y: 0 }, metadata: {} },
          { id: 'tgt', label: 'Tgt', position: { x: 300, y: 0 }, metadata: {} },
          // The actor has no color of its own — it should inherit '#ff00ff'
          // from its parent container rather than falling back to the
          // component's own DEFAULT_ACCENT gray.
          { id: 'box', label: 'Box', position: { x: 0, y: 300 }, metadata: {}, color: '#ff00ff' },
          { id: 'actor', label: 'Actor', parentId: 'box', position: { x: 0, y: 0 }, metadata: {}, isActor: true },
        ],
        edges: [
          {
            id: 'e1',
            sourceId: 'src',
            targetId: 'tgt',
            sets: [state.diagram.edgeSets[0].id],
            metadata: {},
            actorId: 'actor',
          },
        ],
      },
      activeSets: new Set([state.diagram.edgeSets[0].id]),
      expandedNodes: new Set(),
      selected: null,
      multiSelectedNodeIds: new Set(),
      multiSelectedEdgeIds: new Set(),
    }));

    render(
      <ReactFlowProvider>
        <DiagramCanvas />
      </ReactFlowProvider>,
    );

    await waitFor(() => {
      const anchor = document.querySelector('.graph-node__anchor') as HTMLElement | null;
      expect(anchor).not.toBeNull();
      expect(anchor!.style.background).toBe('rgb(255, 0, 255)');
    });
  });
});
