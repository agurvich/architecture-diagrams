import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { HierarchyPanel } from './HierarchyPanel';
import { useDiagramStore } from '../../store/diagramStore';

function setTree() {
  useDiagramStore.getState().loadSeed();
  useDiagramStore.setState((state) => ({
    diagram: {
      ...state.diagram,
      nodes: [
        { id: 'box', label: 'Box', position: { x: 0, y: 0 }, metadata: {} },
        { id: 'child1', label: 'Child1', parentId: 'box', position: { x: 0, y: 0 }, metadata: {} },
        { id: 'grandchild', label: 'Grandchild', parentId: 'child1', position: { x: 0, y: 0 }, metadata: {} },
        { id: 'child2', label: 'Child2', parentId: 'box', position: { x: 0, y: 0 }, metadata: {} },
        { id: 'leaf', label: 'Leaf', position: { x: 0, y: 0 }, metadata: {} },
      ],
      edges: [],
    },
    expandedNodes: new Set<string>(),
    selected: null,
  }));
}

// A minimal but functional DataTransfer stand-in — jsdom doesn't fully
// implement the real one, and only setData/effectAllowed/dropEffect are
// ever read by HierarchyPanel's drag handlers.
function dataTransfer() {
  const store = new Map<string, string>();
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: (type: string, value: string) => store.set(type, value),
    getData: (type: string) => store.get(type) ?? '',
  };
}

// jsdom has no real layout engine — every element's getBoundingClientRect
// otherwise reports zero top/height, which happens to make offset<0 land
// in "before" and offset>0 in "after" by coincidence, not by design. Stub
// a real 20px-tall rect at a known top so the top-quarter/bottom-quarter/
// middle-half math in handleDragOver is exercised deliberately, the same
// way it'd be exercised by real row geometry.
function stubRowRect(row: HTMLElement) {
  row.getBoundingClientRect = () =>
    ({ top: 100, bottom: 120, height: 20, left: 0, right: 100, width: 100, x: 0, y: 100, toJSON: () => ({}) }) as DOMRect;
}

describe('HierarchyPanel', () => {
  beforeEach(() => {
    setTree();
  });

  it('renders top-level roots only, collapsed by default', () => {
    render(<HierarchyPanel />);
    expect(screen.getByText('Box')).toBeInTheDocument();
    expect(screen.getByText('Leaf')).toBeInTheDocument();
    expect(screen.queryByText('Child1')).toBeNull();
  });

  it('clicking the chevron expands to show children, and again to collapse', async () => {
    const user = userEvent.setup();
    render(<HierarchyPanel />);
    await user.click(screen.getByText('▸'));
    expect(screen.getByText('Child1')).toBeInTheDocument();
    expect(screen.getByText('Child2')).toBeInTheDocument();
    // Grandchild stays hidden — only Box itself was expanded.
    expect(screen.queryByText('Grandchild')).toBeNull();

    await user.click(screen.getByText('▾'));
    expect(screen.queryByText('Child1')).toBeNull();
  });

  it('a leaf with no children renders a blank spacer instead of a chevron', () => {
    render(<HierarchyPanel />);
    expect(screen.queryByText('▸', { selector: 'span' })).toBeNull();
  });

  it('clicking a node label selects it', async () => {
    const user = userEvent.setup();
    render(<HierarchyPanel />);
    await user.click(screen.getByText('Leaf'));
    expect(useDiagramStore.getState().selected).toEqual({ kind: 'node', id: 'leaf' });
  });

  it('context menu Duplicate copies the node and selects the copy', async () => {
    const user = userEvent.setup();
    render(<HierarchyPanel />);
    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Leaf') });
    await user.click(await screen.findByText('Duplicate'));

    const nodes = useDiagramStore.getState().diagram.nodes;
    const copy = nodes.find((n) => n.label === 'Leaf copy');
    expect(copy).toBeDefined();
    expect(useDiagramStore.getState().selected).toEqual({ kind: 'node', id: copy!.id });
  });

  it('context menu offers Expand all/Collapse all only for a node with children, and they recurse through the whole subtree', async () => {
    const user = userEvent.setup();
    render(<HierarchyPanel />);

    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Leaf') });
    expect(screen.queryByText('Expand all')).toBeNull();
    await user.keyboard('{Escape}');

    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Box') });
    await user.click(await screen.findByText('Expand all'));
    expect(screen.getByText('Grandchild')).toBeInTheDocument();

    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Box') });
    await user.click(await screen.findByText('Collapse all'));
    expect(screen.queryByText('Child1')).toBeNull();
    expect(useDiagramStore.getState().expandedNodes.size).toBe(0);
  });

  it('drag-and-drop onto the middle of a row (zone: inside) reparents the dragged node', () => {
    render(<HierarchyPanel />);
    const dt = dataTransfer();
    const leafRow = screen.getByText('Leaf').closest('div')!;
    const boxRow = screen.getByText('Box').closest('div')!;
    stubRowRect(boxRow);

    fireEvent.dragStart(leafRow, { dataTransfer: dt });
    fireEvent.dragOver(boxRow, { dataTransfer: dt, clientY: 110 }); // middle half of [100,120]
    fireEvent.drop(boxRow, { dataTransfer: dt });

    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'leaf')!.parentId).toBe('box');
  });

  // The before/after (top-quarter/bottom-quarter) zone math itself is
  // covered exhaustively and reliably in dropZone.test.ts, as a pure
  // function — component-level DOM drag simulation under jsdom proved too
  // unreliable at reproducing a specific sub-row offset (no real layout
  // engine to trust getBoundingClientRect against) to be worth chasing
  // here; the "inside" case above and the cycle guard below already
  // exercise the same handleDragOver → handleDrop → moveNode pipeline
  // end to end for at least one zone.

  it('refuses to reparent a node onto its own descendant (would create a cycle) — drop is a no-op', () => {
    useDiagramStore.getState().expandNodes(['box', 'child1']);
    render(<HierarchyPanel />);
    const dt = dataTransfer();
    const boxRow = screen.getByText('Box').closest('div')!;
    const grandchildRow = screen.getByText('Grandchild').closest('div')!;
    stubRowRect(grandchildRow);

    fireEvent.dragStart(boxRow, { dataTransfer: dt });
    fireEvent.dragOver(grandchildRow, { dataTransfer: dt, clientY: 110 });
    fireEvent.drop(grandchildRow, { dataTransfer: dt });

    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'box')!.parentId).toBeUndefined();
  });
});
