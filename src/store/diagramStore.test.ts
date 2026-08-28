import { beforeEach, describe, expect, it } from 'vitest';
import { useDiagramStore } from './diagramStore';
import { anchorIdFor } from '../engine/actorAnchor';

// Actor/action/trigger cascade rules: a trigger edge's targetId is a
// synthetic anchor (anchorIdFor(actionEdgeId)), not a real node, so it
// only makes sense alongside its action edge and can't be reversed.
describe('diagramStore — actor/action/trigger cascades', () => {
  beforeEach(() => {
    useDiagramStore.getState().loadSeed();
  });

  function setup() {
    const { addNode, addEdge, updateNode } = useDiagramStore.getState();
    const a = addNode({ label: 'Bucket A', position: { x: 0, y: 0 }, metadata: {} });
    const b = addNode({ label: 'Bucket B', position: { x: 200, y: 0 }, metadata: {} });
    const step = addNode({ label: 'Copy step', position: { x: 0, y: 200 }, metadata: {} });
    const actor = addNode({ label: 'AV Lambda Role', position: { x: 400, y: 0 }, metadata: {} });
    updateNode(actor, { isActor: true });
    const setId = useDiagramStore.getState().diagram.edgeSets[0].id;
    const actionEdgeId = addEdge(a, b, [setId], undefined, undefined, actor);
    const triggerEdgeId = addEdge(step, anchorIdFor(actionEdgeId), [setId]);
    return { a, b, step, actor, actionEdgeId, triggerEdgeId };
  }

  it('deleteEdge on an action edge cascades to delete triggers pointing at its anchor', () => {
    const { actionEdgeId, triggerEdgeId } = setup();
    useDiagramStore.getState().deleteEdge(actionEdgeId);
    const ids = useDiagramStore.getState().diagram.edges.map((e) => e.id);
    expect(ids).not.toContain(actionEdgeId);
    expect(ids).not.toContain(triggerEdgeId);
  });

  it('deleteNode on the actor clears actorId on its action edges and cascades to their triggers', () => {
    const { actor, actionEdgeId, triggerEdgeId } = setup();
    useDiagramStore.getState().deleteNode(actor);
    const diagram = useDiagramStore.getState().diagram;
    const action = diagram.edges.find((e) => e.id === actionEdgeId);
    expect(action).toBeDefined();
    expect(action!.actorId).toBeUndefined();
    expect(diagram.edges.some((e) => e.id === triggerEdgeId)).toBe(false);
  });

  it('reverseEdge does not touch a trigger edge (its targetId is a synthetic anchor, not a real node)', () => {
    const { triggerEdgeId, step, actionEdgeId } = setup();
    useDiagramStore.getState().reverseEdge(triggerEdgeId);
    const trigger = useDiagramStore.getState().diagram.edges.find((e) => e.id === triggerEdgeId)!;
    expect(trigger.sourceId).toBe(step);
    expect(trigger.targetId).toBe(anchorIdFor(actionEdgeId));
  });
});

describe('diagramStore — frame highlight authoring', () => {
  beforeEach(() => {
    useDiagramStore.getState().loadSeed();
  });

  it('toggleFrameHighlightIds adds ids not yet present, all at once', () => {
    const { saveFrame, toggleFrameHighlightIds } = useDiagramStore.getState();
    const frameId = saveFrame('Test frame', '');
    toggleFrameHighlightIds(frameId, ['a', 'b']);
    const frame = useDiagramStore.getState().diagram.frames.find((f) => f.id === frameId)!;
    expect(frame.highlighted?.sort()).toEqual(['a', 'b']);
  });

  it('toggleFrameHighlightIds removes the whole group when every id in it is already present (all-or-nothing)', () => {
    const { saveFrame, toggleFrameHighlightIds } = useDiagramStore.getState();
    const frameId = saveFrame('Test frame', '');
    toggleFrameHighlightIds(frameId, ['a', 'b']);
    toggleFrameHighlightIds(frameId, ['a', 'b']);
    const frame = useDiagramStore.getState().diagram.frames.find((f) => f.id === frameId)!;
    expect(frame.highlighted).toBeUndefined();
  });

  it('toggleFrameHighlightIds adds the missing ones when only some of the group is present', () => {
    const { saveFrame, toggleFrameHighlightIds } = useDiagramStore.getState();
    const frameId = saveFrame('Test frame', '');
    toggleFrameHighlightIds(frameId, ['a']);
    toggleFrameHighlightIds(frameId, ['a', 'b']);
    const frame = useDiagramStore.getState().diagram.frames.find((f) => f.id === frameId)!;
    expect(frame.highlighted?.sort()).toEqual(['a', 'b']);
  });

  it("setEditingHighlightsForFrame(id) also jumps to that frame's own lens/expand state", () => {
    const { saveFrame, toggleEdgeSet, setEditingHighlightsForFrame } = useDiagramStore.getState();
    // Capture a frame with only the first lens active, then flip lenses
    // around before entering edit mode — editing should restore the
    // frame's own state, not leave whatever was on screen before.
    const firstSet = useDiagramStore.getState().diagram.edgeSets[0].id;
    const frameId = saveFrame('Test frame', '');
    useDiagramStore.getState().updateFrame(frameId, { activeSets: [firstSet] });
    toggleEdgeSet(firstSet); // now inactive
    expect(useDiagramStore.getState().activeSets.has(firstSet)).toBe(false);

    setEditingHighlightsForFrame(frameId);
    expect(useDiagramStore.getState().activeSets.has(firstSet)).toBe(true);
    expect(useDiagramStore.getState().editingHighlightsForFrameId).toBe(frameId);

    setEditingHighlightsForFrame(null);
    expect(useDiagramStore.getState().editingHighlightsForFrameId).toBeNull();
  });
});

describe('diagramStore — import and reset to imported', () => {
  beforeEach(() => {
    useDiagramStore.getState().loadSeed();
  });

  const importedJson = JSON.stringify({
    nodes: [{ id: 'imported-node', label: 'Imported Node', position: { x: 0, y: 0 }, metadata: {} }],
    edges: [],
    edgeSets: [{ id: 'set-1', name: 'Set 1', color: '#fff' }],
    frames: [],
  });

  it('resetToImported is a no-op when nothing has been imported this session', () => {
    const before = useDiagramStore.getState().diagram;
    useDiagramStore.getState().resetToImported();
    expect(useDiagramStore.getState().diagram).toBe(before);
  });

  it('importJSON loads the file and remembers it; resetToImported returns to it after further edits', () => {
    useDiagramStore.getState().importJSON(importedJson);
    expect(useDiagramStore.getState().diagram.nodes.map((n) => n.id)).toEqual(['imported-node']);

    useDiagramStore.getState().addNode({ label: 'Extra', position: { x: 0, y: 0 }, metadata: {} });
    expect(useDiagramStore.getState().diagram.nodes.length).toBe(2);

    useDiagramStore.getState().resetToImported();
    expect(useDiagramStore.getState().diagram.nodes.map((n) => n.id)).toEqual(['imported-node']);
  });

  it('resetToImported clears view state the same way loadSeed does', () => {
    useDiagramStore.getState().importJSON(importedJson);
    useDiagramStore.getState().select({ kind: 'node', id: 'imported-node' });
    useDiagramStore.getState().toggleExpand('imported-node');

    useDiagramStore.getState().resetToImported();

    const state = useDiagramStore.getState();
    expect(state.selected).toBeNull();
    expect(state.expandedNodes.size).toBe(0);
    expect(state.currentFrameId).toBeNull();
  });
});

describe('diagramStore — moveNode (hierarchy panel drag-to-reorder/reparent)', () => {
  beforeEach(() => {
    useDiagramStore.getState().loadSeed();
  });

  function threeRoots() {
    const { addNode } = useDiagramStore.getState();
    const a = addNode({ label: 'A', position: { x: 0, y: 0 }, metadata: {} });
    const b = addNode({ label: 'B', position: { x: 0, y: 0 }, metadata: {} });
    const c = addNode({ label: 'C', position: { x: 0, y: 0 }, metadata: {} });
    return { a, b, c };
  }

  // Filters to just the given ids, in their current relative array order —
  // the seed diagram already has its own top-level nodes, so a bare
  // "every root, in order" comparison would break the moment the demo
  // data changes (as it already has several times this project).
  function orderOf(ids: string[]) {
    const order = useDiagramStore.getState().diagram.nodes.map((n) => n.id);
    return [...ids].sort((x, y) => order.indexOf(x) - order.indexOf(y));
  }

  it('reorders a node before a sibling, keeping the same parent', () => {
    const { a, b, c } = threeRoots();
    useDiagramStore.getState().moveNode(c, undefined, a);
    expect(orderOf([a, b, c])).toEqual([c, a, b]);
  });

  it("reorders a node after a sibling by using the sibling's current successor as beforeId", () => {
    const { a, b, c } = threeRoots();
    // Move A to sit right after B: beforeId = whichever node currently
    // follows B among A's future siblings (C).
    useDiagramStore.getState().moveNode(a, undefined, c);
    expect(orderOf([a, b, c])).toEqual([b, a, c]);
  });

  it('moves a node to the end when beforeId is undefined', () => {
    const { a, b, c } = threeRoots();
    useDiagramStore.getState().moveNode(a, undefined, undefined);
    expect(orderOf([a, b, c])).toEqual([b, c, a]);
  });

  it('reparents a node when dropped "inside" another (parentId changes, appended at the end of the new parent\'s children)', () => {
    const { a, b, c } = threeRoots();
    useDiagramStore.getState().moveNode(c, a, undefined);
    const nodes = useDiagramStore.getState().diagram.nodes;
    expect(nodes.find((n) => n.id === c)!.parentId).toBe(a);
    expect(nodes.filter((n) => n.parentId === a).map((n) => n.id)).toEqual([c]);
    void b;
  });

  it('reordering across a reparenting drop (before a specific child of the new parent) works in one call', () => {
    const { addNode } = useDiagramStore.getState();
    const parent = addNode({ label: 'Parent', position: { x: 0, y: 0 }, metadata: {} });
    const child1 = addNode({ label: 'Child1', parentId: parent, position: { x: 0, y: 0 }, metadata: {} });
    const outsider = addNode({ label: 'Outsider', position: { x: 0, y: 0 }, metadata: {} });

    useDiagramStore.getState().moveNode(outsider, parent, child1);

    const nodes = useDiagramStore.getState().diagram.nodes;
    expect(nodes.find((n) => n.id === outsider)!.parentId).toBe(parent);
    expect(nodes.filter((n) => n.parentId === parent).map((n) => n.id)).toEqual([outsider, child1]);
  });
});

describe('diagramStore — toggleMultiSelectedEdge', () => {
  beforeEach(() => {
    useDiagramStore.getState().loadSeed();
  });

  it('adds an edge id not yet present, and clears any single selection', () => {
    useDiagramStore.getState().select({ kind: 'node', id: 'some-node' });
    useDiagramStore.getState().toggleMultiSelectedEdge('e1');
    const state = useDiagramStore.getState();
    expect(state.multiSelectedEdgeIds.has('e1')).toBe(true);
    expect(state.selected).toBeNull();
  });

  it('removes it again on a second toggle', () => {
    useDiagramStore.getState().toggleMultiSelectedEdge('e1');
    useDiagramStore.getState().toggleMultiSelectedEdge('e1');
    expect(useDiagramStore.getState().multiSelectedEdgeIds.has('e1')).toBe(false);
  });

  it('accumulates several edges independently', () => {
    useDiagramStore.getState().toggleMultiSelectedEdge('e1');
    useDiagramStore.getState().toggleMultiSelectedEdge('e2');
    const ids = useDiagramStore.getState().multiSelectedEdgeIds;
    expect([...ids].sort()).toEqual(['e1', 'e2']);
  });
});

describe('diagramStore — runGraphLayout', () => {
  beforeEach(() => {
    useDiagramStore.getState().loadSeed();
  });

  function setFlatTopLevel() {
    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        nodes: [
          { id: 'a', label: 'A', position: { x: 500, y: 500 }, metadata: {} },
          { id: 'b', label: 'B', position: { x: 900, y: 100 }, metadata: {} },
          { id: 'c', label: 'C', position: { x: 100, y: 900 }, metadata: {} },
        ],
        edges: [
          { id: 'e1', sourceId: 'a', targetId: 'b', sets: [state.diagram.edgeSets[0].id], metadata: {} },
          { id: 'e2', sourceId: 'b', targetId: 'c', sets: [state.diagram.edgeSets[0].id], metadata: {} },
        ],
      },
      activeSets: new Set([state.diagram.edgeSets[0].id]),
      expandedNodes: new Set(),
    }));
  }

  it('repositions top-level nodes without touching parentId or node/edge count', async () => {
    setFlatTopLevel();
    await useDiagramStore.getState().runGraphLayout(null);

    const diagram = useDiagramStore.getState().diagram;
    expect(diagram.nodes).toHaveLength(3);
    expect(diagram.edges).toHaveLength(2);
    for (const n of diagram.nodes) expect(n.parentId).toBeUndefined();
    // elk chose *some* new arrangement — not asserting exact coordinates
    // (that's elk's own algorithm, not ours to pin down), just that this
    // actually moved something instead of being a no-op.
    const moved = diagram.nodes.some((n) => n.position.x !== 500 && n.id === 'a');
    expect(moved || diagram.nodes.find((n) => n.id === 'b')!.position.y !== 100).toBe(true);
  });

  it('lays out a container’s direct children flush against its padded interior, leaving nesting and other nodes alone', async () => {
    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        nodes: [
          { id: 'box', label: 'Box', position: { x: 0, y: 0 }, metadata: {} },
          { id: 'child1', label: 'Child1', parentId: 'box', position: { x: 999, y: 999 }, metadata: {} },
          { id: 'child2', label: 'Child2', parentId: 'box', position: { x: -50, y: -50 }, metadata: {} },
          { id: 'outsider', label: 'Outsider', position: { x: 42, y: 42 }, metadata: {} },
        ],
        edges: [{ id: 'e1', sourceId: 'child1', targetId: 'child2', sets: [state.diagram.edgeSets[0].id], metadata: {} }],
      },
      activeSets: new Set([state.diagram.edgeSets[0].id]),
      expandedNodes: new Set(['box']),
    }));

    await useDiagramStore.getState().runGraphLayout('box');

    const nodes = useDiagramStore.getState().diagram.nodes;
    expect(nodes.find((n) => n.id === 'child1')!.parentId).toBe('box');
    expect(nodes.find((n) => n.id === 'child2')!.parentId).toBe('box');
    // Flush against the container's own padded interior — never negative,
    // never drifting back out to where they started.
    for (const id of ['child1', 'child2']) {
      const pos = nodes.find((n) => n.id === id)!.position;
      expect(pos.x).toBeGreaterThanOrEqual(20);
      expect(pos.y).toBeGreaterThanOrEqual(34);
    }
    // Nothing outside this container was touched.
    expect(nodes.find((n) => n.id === 'outsider')!.position).toEqual({ x: 42, y: 42 });
    expect(nodes.find((n) => n.id === 'box')!.position).toEqual({ x: 0, y: 0 });
  });

  it('is a no-op on a container that has its own auto layout — that already owns its children’s positions', async () => {
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
          { id: 'child1', label: 'Child1', parentId: 'box', position: { x: 5, y: 5 }, metadata: {} },
          { id: 'child2', label: 'Child2', parentId: 'box', position: { x: 7, y: 7 }, metadata: {} },
        ],
        edges: [],
      },
      activeSets: new Set([state.diagram.edgeSets[0].id]),
      expandedNodes: new Set(['box']),
    }));

    await useDiagramStore.getState().runGraphLayout('box');

    const nodes = useDiagramStore.getState().diagram.nodes;
    expect(nodes.find((n) => n.id === 'child1')!.position).toEqual({ x: 5, y: 5 });
    expect(nodes.find((n) => n.id === 'child2')!.position).toEqual({ x: 7, y: 7 });
  });
});

describe('diagramStore — edge and edge-set CRUD', () => {
  beforeEach(() => {
    useDiagramStore.getState().loadSeed();
  });

  it('updateEdge patches fields on the matching raw edge only', () => {
    const { addNode, addEdge, updateEdge } = useDiagramStore.getState();
    const a = addNode({ label: 'A', position: { x: 0, y: 0 }, metadata: {} });
    const b = addNode({ label: 'B', position: { x: 0, y: 0 }, metadata: {} });
    const setId = useDiagramStore.getState().diagram.edgeSets[0].id;
    const edgeId = addEdge(a, b, [setId]);

    updateEdge(edgeId, { metadata: { note: 'reviewed' } });

    const edge = useDiagramStore.getState().diagram.edges.find((e) => e.id === edgeId)!;
    expect(edge.metadata).toEqual({ note: 'reviewed' });
    expect(edge.sourceId).toBe(a);
  });

  it('addEdgeSet appends a new set and activates it immediately', () => {
    const before = useDiagramStore.getState().diagram.edgeSets.length;
    const id = useDiagramStore.getState().addEdgeSet('Deploy Flow', '#123456');

    const state = useDiagramStore.getState();
    expect(state.diagram.edgeSets).toHaveLength(before + 1);
    expect(state.diagram.edgeSets.at(-1)).toEqual({ id, name: 'Deploy Flow', color: '#123456' });
    expect(state.activeSets.has(id)).toBe(true);
  });

  it('updateEdgeSet patches name/color on the matching set only', () => {
    const setId = useDiagramStore.getState().diagram.edgeSets[0].id;
    const otherSet = useDiagramStore.getState().diagram.edgeSets[1];

    useDiagramStore.getState().updateEdgeSet(setId, { name: 'Renamed', color: '#abcdef' });

    const sets = useDiagramStore.getState().diagram.edgeSets;
    expect(sets.find((s) => s.id === setId)).toEqual({ id: setId, name: 'Renamed', color: '#abcdef' });
    expect(sets.find((s) => s.id === otherSet.id)).toEqual(otherSet);
  });
});

describe('diagramStore — duplicateNode, setNodeParent, expandNodes/collapseNodes', () => {
  beforeEach(() => {
    useDiagramStore.getState().loadSeed();
  });

  it('duplicateNode copies a childless node with an offset position and a " copy" label suffix', () => {
    const { addNode, duplicateNode } = useDiagramStore.getState();
    const original = addNode({ label: 'Bucket', position: { x: 100, y: 100 }, metadata: { env: 'prod' } });

    const copyId = duplicateNode(original)!;

    const nodes = useDiagramStore.getState().diagram.nodes;
    const copy = nodes.find((n) => n.id === copyId)!;
    expect(copy.id).not.toBe(original);
    expect(copy.label).toBe('Bucket copy');
    expect(copy.position).toEqual({ x: 160, y: 160 });
    expect(copy.metadata).toEqual({ env: 'prod' });
  });

  it('duplicateNode copies a container and its whole descendant subtree, remapping parentId within the copy', () => {
    const { addNode, duplicateNode } = useDiagramStore.getState();
    const container = addNode({ label: 'Box', position: { x: 0, y: 0 }, metadata: {} });
    const child = addNode({ label: 'Child', parentId: container, position: { x: 10, y: 10 }, metadata: {} });

    const containerCopyId = duplicateNode(container)!;

    const nodes = useDiagramStore.getState().diagram.nodes;
    const childCopies = nodes.filter((n) => n.parentId === containerCopyId);
    expect(childCopies).toHaveLength(1);
    expect(childCopies[0].label).toBe('Child');
    expect(childCopies[0].id).not.toBe(child);
    // Descendant copies keep their own relative position untouched — only
    // the top-level copy gets the offset.
    expect(childCopies[0].position).toEqual({ x: 10, y: 10 });
  });

  it('duplicateNode returns null for a nonexistent source id', () => {
    expect(useDiagramStore.getState().duplicateNode('does-not-exist')).toBeNull();
  });

  it('setNodeParent reparents a node without touching its position or siblings', () => {
    const { addNode, setNodeParent } = useDiagramStore.getState();
    const parent = addNode({ label: 'Parent', position: { x: 0, y: 0 }, metadata: {} });
    const child = addNode({ label: 'Child', position: { x: 5, y: 5 }, metadata: {} });

    setNodeParent(child, parent);

    const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === child)!;
    expect(node.parentId).toBe(parent);
    expect(node.position).toEqual({ x: 5, y: 5 });
  });

  it('setNodeParent(id, undefined) un-parents a node back to top level', () => {
    const { addNode, setNodeParent } = useDiagramStore.getState();
    const parent = addNode({ label: 'Parent', position: { x: 0, y: 0 }, metadata: {} });
    const child = addNode({ label: 'Child', parentId: parent, position: { x: 5, y: 5 }, metadata: {} });

    setNodeParent(child, undefined);

    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === child)!.parentId).toBeUndefined();
  });

  it('expandNodes adds ids without touching already-expanded ones; collapseNodes removes them', () => {
    const { expandNodes, collapseNodes, toggleExpand } = useDiagramStore.getState();
    toggleExpand('already-expanded');

    expandNodes(['a', 'b', 'c']);
    expect([...useDiagramStore.getState().expandedNodes].sort()).toEqual(['a', 'already-expanded', 'b', 'c'].sort());

    collapseNodes(['a', 'c']);
    const remaining = useDiagramStore.getState().expandedNodes;
    expect(remaining.has('a')).toBe(false);
    expect(remaining.has('c')).toBe(false);
    expect(remaining.has('b')).toBe(true);
    expect(remaining.has('already-expanded')).toBe(true);
  });
});

describe('diagramStore — loadExample and exportJSON', () => {
  const customDiagram = {
    nodes: [{ id: 'only-node', label: 'Only Node', position: { x: 0, y: 0 }, metadata: {} }],
    edges: [],
    edgeSets: [{ id: 'set-a', name: 'Set A', color: '#000000' }],
    frames: [],
  };

  it('loadExample replaces the diagram and resets view state (selection, expand, frame) to defaults', () => {
    useDiagramStore.getState().loadSeed();
    useDiagramStore.getState().select({ kind: 'node', id: 'node_w8QcqZ1P' });
    useDiagramStore.getState().toggleExpand('some-node');

    useDiagramStore.getState().loadExample(customDiagram);

    const state = useDiagramStore.getState();
    expect(state.diagram.nodes.map((n) => n.id)).toEqual(['only-node']);
    expect(state.activeSets.has('set-a')).toBe(true);
    expect(state.selected).toBeNull();
    expect(state.expandedNodes.size).toBe(0);
    expect(state.currentFrameId).toBeNull();
  });

  it('loadExample clones its input — mutating the store afterward does not touch the passed-in object', () => {
    useDiagramStore.getState().loadExample(customDiagram);
    useDiagramStore.getState().updateNode('only-node', { label: 'Renamed' });
    expect(customDiagram.nodes[0].label).toBe('Only Node');
  });

  it('exportJSON round-trips through importJSON to reproduce the same diagram shape', () => {
    useDiagramStore.getState().loadExample(customDiagram);
    const json = useDiagramStore.getState().exportJSON();

    useDiagramStore.getState().loadSeed();
    expect(useDiagramStore.getState().diagram.nodes.map((n) => n.id)).not.toEqual(['only-node']);

    useDiagramStore.getState().importJSON(json);
    expect(useDiagramStore.getState().diagram.nodes.map((n) => n.id)).toEqual(['only-node']);
  });
});

describe('diagramStore — frame playback (gotoFrame/nextFrame/prevFrame) and deleteFrame/reorderFrames', () => {
  function threeFrames() {
    useDiagramStore.getState().loadSeed();
    // The seed diagram ships with its own frames — clear them first so
    // this helper's 3 frames are the only ones in play.
    useDiagramStore.setState((s) => ({ diagram: { ...s.diagram, frames: [] } }));
    const setId = useDiagramStore.getState().diagram.edgeSets[0].id;
    const { saveFrame, updateFrame } = useDiagramStore.getState();
    const f1 = saveFrame('Frame 1', '');
    updateFrame(f1, { activeSets: [setId] });
    const f2 = saveFrame('Frame 2', '');
    updateFrame(f2, { activeSets: [] });
    const f3 = saveFrame('Frame 3', '');
    updateFrame(f3, { activeSets: [setId] });
    return { f1, f2, f3, setId };
  }

  it('nextFrame steps from no active frame to the first frame, then advances, and stops at the last', () => {
    const { f1, f2, f3 } = threeFrames();
    // saveFrame itself left currentFrameId on the last-saved frame — reset
    // to "nothing playing" to test nextFrame's own starting-point logic.
    useDiagramStore.setState({ currentFrameId: null });

    useDiagramStore.getState().nextFrame();
    expect(useDiagramStore.getState().currentFrameId).toBe(f1);
    useDiagramStore.getState().nextFrame();
    expect(useDiagramStore.getState().currentFrameId).toBe(f2);
    useDiagramStore.getState().nextFrame();
    expect(useDiagramStore.getState().currentFrameId).toBe(f3);
    useDiagramStore.getState().nextFrame();
    expect(useDiagramStore.getState().currentFrameId).toBe(f3);
  });

  it('prevFrame steps backward and stops at the first frame', () => {
    const { f1, f2, f3 } = threeFrames();
    useDiagramStore.getState().gotoFrame(f3);

    useDiagramStore.getState().prevFrame();
    expect(useDiagramStore.getState().currentFrameId).toBe(f2);
    useDiagramStore.getState().prevFrame();
    expect(useDiagramStore.getState().currentFrameId).toBe(f1);
    useDiagramStore.getState().prevFrame();
    expect(useDiagramStore.getState().currentFrameId).toBe(f1);
  });

  it('gotoFrame applies that frame\'s own activeSets/expandedNodes snapshot', () => {
    const { f2, setId } = threeFrames();
    useDiagramStore.getState().gotoFrame(f2);
    expect(useDiagramStore.getState().activeSets.has(setId)).toBe(false);
  });

  it('nextFrame/prevFrame are no-ops when there are no frames at all', () => {
    useDiagramStore.getState().loadSeed();
    useDiagramStore.setState((s) => ({ diagram: { ...s.diagram, frames: [] }, currentFrameId: null }));
    useDiagramStore.getState().nextFrame();
    useDiagramStore.getState().prevFrame();
    expect(useDiagramStore.getState().currentFrameId).toBeNull();
  });

  it('deleteFrame removes just that frame, leaving the others and their order intact', () => {
    const { f1, f2, f3 } = threeFrames();
    useDiagramStore.getState().deleteFrame(f2);
    expect(useDiagramStore.getState().diagram.frames.map((f) => f.id)).toEqual([f1, f3]);
  });

  it('reorderFrames moves a frame from one index to another', () => {
    const { f1, f2, f3 } = threeFrames();
    useDiagramStore.getState().reorderFrames(0, 2);
    expect(useDiagramStore.getState().diagram.frames.map((f) => f.id)).toEqual([f2, f3, f1]);
  });
});

describe('diagramStore — exitFrameView', () => {
  beforeEach(() => {
    useDiagramStore.getState().loadSeed();
  });

  it('clears currentFrameId back to null', () => {
    const frameId = useDiagramStore.getState().diagram.frames[0].id;
    useDiagramStore.getState().gotoFrame(frameId);
    expect(useDiagramStore.getState().currentFrameId).toBe(frameId);

    useDiagramStore.getState().exitFrameView();
    expect(useDiagramStore.getState().currentFrameId).toBeNull();
  });

  it('leaves activeSets/expandedNodes/nodeLensKey exactly as that frame set them', () => {
    const state = useDiagramStore.getState();
    const frame = state.diagram.frames[0];
    state.gotoFrame(frame.id);
    const activeSetsBefore = new Set(useDiagramStore.getState().activeSets);
    const expandedBefore = new Set(useDiagramStore.getState().expandedNodes);

    useDiagramStore.getState().exitFrameView();

    expect(useDiagramStore.getState().activeSets).toEqual(activeSetsBefore);
    expect(useDiagramStore.getState().expandedNodes).toEqual(expandedBefore);
  });

  it('is a harmless no-op when no frame is currently active', () => {
    useDiagramStore.setState({ currentFrameId: null });
    expect(() => useDiagramStore.getState().exitFrameView()).not.toThrow();
    expect(useDiagramStore.getState().currentFrameId).toBeNull();
  });
});

describe('diagramStore — sticky notes (addStickyNote/updateStickyNote/deleteStickyNote)', () => {
  let frameId: string;

  beforeEach(() => {
    useDiagramStore.getState().loadSeed();
    frameId = useDiagramStore.getState().saveFrame('Test frame', '');
  });

  function notesOf(id: string) {
    return useDiagramStore.getState().diagram.frames.find((f) => f.id === id)?.stickyNotes ?? [];
  }

  it('addStickyNote appends a blank note with a color and a position, returns its id', () => {
    const noteId = useDiagramStore.getState().addStickyNote(frameId);
    const notes = notesOf(frameId);
    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe(noteId);
    expect(notes[0].text).toBe('');
    expect(notes[0].color).toBeTruthy();
    expect(notes[0].position).toEqual({ x: expect.any(Number), y: expect.any(Number) });
  });

  it('addStickyNote cycles colors and staggers position so notes don\'t land exactly on top of each other', () => {
    const { addStickyNote } = useDiagramStore.getState();
    addStickyNote(frameId);
    addStickyNote(frameId);
    const notes = notesOf(frameId);
    expect(notes).toHaveLength(2);
    expect(notes[0].id).not.toBe(notes[1].id);
    expect(notes[0].color).not.toBe(notes[1].color);
    expect(notes[0].position).not.toEqual(notes[1].position);
  });

  it('updateStickyNote can move a note by patching its position (the drag path)', () => {
    const { addStickyNote, updateStickyNote } = useDiagramStore.getState();
    const id = addStickyNote(frameId);
    const before = notesOf(frameId)[0].position;
    updateStickyNote(frameId, id, { position: { x: before.x + 150, y: before.y - 40 } });
    expect(notesOf(frameId)[0].position).toEqual({ x: before.x + 150, y: before.y - 40 });
  });

  it('updateStickyNote patches just that note, leaving others in the frame untouched', () => {
    const { addStickyNote, updateStickyNote } = useDiagramStore.getState();
    const a = addStickyNote(frameId);
    const b = addStickyNote(frameId);
    updateStickyNote(frameId, a, { text: 'Hello' });
    const notes = notesOf(frameId);
    expect(notes.find((n) => n.id === a)?.text).toBe('Hello');
    expect(notes.find((n) => n.id === b)?.text).toBe('');
  });

  it('deleteStickyNote removes just that note', () => {
    const { addStickyNote, deleteStickyNote } = useDiagramStore.getState();
    const a = addStickyNote(frameId);
    const b = addStickyNote(frameId);
    deleteStickyNote(frameId, a);
    const notes = notesOf(frameId);
    expect(notes.map((n) => n.id)).toEqual([b]);
  });

  it('sticky notes are scoped to their own frame, not shared across frames', () => {
    const otherFrameId = useDiagramStore.getState().saveFrame('Other frame', '');
    useDiagramStore.getState().addStickyNote(frameId);
    expect(notesOf(frameId)).toHaveLength(1);
    expect(notesOf(otherFrameId)).toHaveLength(0);
  });
});
