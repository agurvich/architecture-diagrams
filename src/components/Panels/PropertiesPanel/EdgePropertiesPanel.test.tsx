import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlow, ReactFlowProvider, type Node } from '@xyflow/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { EdgePropertiesPanel } from './EdgePropertiesPanel';
import { useDiagramStore } from '../../../store/diagramStore';
import { anchorIdFor } from '../../../engine/actorAnchor';

function setSimpleDiagram() {
  useDiagramStore.getState().loadSeed();
  useDiagramStore.setState((state) => ({
    diagram: {
      ...state.diagram,
      nodes: [
        { id: 'src', label: 'Source', position: { x: 0, y: 0 }, metadata: {} },
        { id: 'tgt', label: 'Target', position: { x: 300, y: 0 }, metadata: {} },
        { id: 'actor', label: 'Actor Role', position: { x: 0, y: 200 }, metadata: {}, isActor: true },
      ],
      edges: [
        {
          id: 'edge1',
          sourceId: 'src',
          targetId: 'tgt',
          sets: [state.diagram.edgeSets[0].id],
          metadata: {},
        },
      ],
    },
    activeSets: new Set([state.diagram.edgeSets[0].id]),
    expandedNodes: new Set(),
  }));
}

// EdgePropertiesPanel calls useReactFlow().getInternalNode — that only
// resolves once real nodes are registered into an actual <ReactFlow>
// instance's internal store, not just a bare <ReactFlowProvider>. Node
// position/size resolve synchronously from props here (no ResizeObserver
// needed — ­see floatingEdgeUtils.ts's sizeOf comment), so a minimal
// <ReactFlow> with the same nodes, sized/positioned like DiagramCanvas
// does, is enough to exercise the real getInternalNode path under jsdom.
function renderWithRfNodes(effectiveEdgeId: string) {
  const nodes: Node[] = useDiagramStore
    .getState()
    .diagram.nodes.map((n) => ({
      id: n.id,
      type: 'default',
      position: n.position,
      data: {},
      width: 170,
      height: 64,
    }));
  return render(
    <ReactFlowProvider>
      <ReactFlow nodes={nodes} edges={[]} />
      <EdgePropertiesPanel effectiveEdgeId={effectiveEdgeId} />
    </ReactFlowProvider>,
  );
}

describe('EdgePropertiesPanel', () => {
  beforeEach(() => {
    setSimpleDiagram();
  });

  it('returns null for an effective edge id that does not resolve (e.g. filtered out by an inactive lens)', () => {
    renderWithRfNodes('merged:nonexistent=>id');
    expect(document.querySelector('.properties-panel')).toBeNull();
  });

  it('toggling a set checkbox adds/removes it from the raw edge', async () => {
    const user = userEvent.setup();
    const secondSet = useDiagramStore.getState().diagram.edgeSets[1].id;
    renderWithRfNodes('merged:src=>tgt');

    const checkboxes = screen.getAllByRole('checkbox');
    // The seed's second lens starts unchecked on this edge.
    await user.click(checkboxes[1]);
    expect(useDiagramStore.getState().diagram.edges.find((e) => e.id === 'edge1')!.sets).toContain(secondSet);

    await user.click(checkboxes[1]);
    expect(useDiagramStore.getState().diagram.edges.find((e) => e.id === 'edge1')!.sets).not.toContain(secondSet);
  });

  it('shows an Actor dropdown for a plain edge and lets you assign one', async () => {
    const user = userEvent.setup();
    renderWithRfNodes('merged:src=>tgt');
    await user.selectOptions(screen.getByLabelText('Actor'), 'Actor Role');
    expect(useDiagramStore.getState().diagram.edges.find((e) => e.id === 'edge1')!.actorId).toBe('actor');
  });

  it('editing the Label field updates edge metadata.label', async () => {
    const user = userEvent.setup();
    renderWithRfNodes('merged:src=>tgt');
    await user.type(screen.getByLabelText('Label'), 'Copy file');
    expect(useDiagramStore.getState().diagram.edges.find((e) => e.id === 'edge1')!.metadata.label).toBe('Copy file');
  });

  it('turning the Anchor switch on pins sourceHandle/targetHandle from the current floating geometry', async () => {
    const user = userEvent.setup();
    renderWithRfNodes('merged:src=>tgt');

    await user.click(screen.getByRole('switch', { name: 'Anchor' }));

    const edge = useDiagramStore.getState().diagram.edges.find((e) => e.id === 'edge1')!;
    expect(edge.sourceHandle).toBeDefined();
    expect(edge.targetHandle).toBeDefined();
    // src is directly to the left of tgt, so floating geometry should
    // resolve to right/left, not top/bottom.
    expect(edge.sourceHandle).toBe('right');
    expect(edge.targetHandle).toBe('left');
  });

  it('turning the Anchor switch off clears sourceHandle/targetHandle without touching anything else', async () => {
    useDiagramStore.getState().updateEdge('edge1', { sourceHandle: 'right', targetHandle: 'left' });
    const user = userEvent.setup();
    renderWithRfNodes('merged:src=>tgt');

    await user.click(screen.getByRole('switch', { name: 'Anchor' }));

    const edge = useDiagramStore.getState().diagram.edges.find((e) => e.id === 'edge1')!;
    expect(edge.sourceHandle).toBeUndefined();
    expect(edge.targetHandle).toBeUndefined();
    expect(edge.sourceId).toBe('src');
  });

  it('hides the Actor field entirely for a trigger edge (target is a synthetic anchor)', () => {
    useDiagramStore.getState().updateEdge('edge1', { actorId: 'actor' });
    const triggerId = useDiagramStore.getState().addEdge('src', anchorIdFor('edge1'), [
      useDiagramStore.getState().diagram.edgeSets[0].id,
    ]);
    renderWithRfNodes(`merged:src=>${anchorIdFor('edge1')}`);
    void triggerId;
    expect(screen.queryByLabelText('Actor')).toBeNull();
  });

  it('Delete edge removes the raw edge and clears selection', async () => {
    const user = userEvent.setup();
    useDiagramStore.getState().select({ kind: 'edge', id: 'merged:src=>tgt' });
    renderWithRfNodes('merged:src=>tgt');

    await user.click(screen.getByRole('button', { name: 'Delete edge' }));

    expect(useDiagramStore.getState().diagram.edges.some((e) => e.id === 'edge1')).toBe(false);
    expect(useDiagramStore.getState().selected).toBeNull();
  });

  it('a merged edge (count > 1) shows the underlying relationships list instead of the single-edge form', () => {
    const setId = useDiagramStore.getState().diagram.edgeSets[0].id;
    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        edges: [
          ...state.diagram.edges,
          { id: 'edge2', sourceId: 'src', targetId: 'tgt', sets: [setId], metadata: { label: 'second' } },
        ],
      },
    }));
    renderWithRfNodes('merged:src=>tgt');
    expect(screen.getByText('Merged edge (2)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Label')).toBeNull();
  });
});
