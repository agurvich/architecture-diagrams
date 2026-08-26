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
