import { describe, expect, it } from 'vitest';
import type { Diagram } from '../types/diagram';
import type { EffectiveNode } from '../types/effectiveGraph';
import { UNCLASSIFIED_REGION, applyNodeLens, computeBundleRootOf } from './nodeLens';

// Three top-level trees exercising every case at once:
// - a (tagged 'blue') -> a-child (untagged, rides with a)
// - b (tagged 'green') -> b-mid (untagged, rides with b) -> b-deep (tagged
//   'blue' — breaks away from b/b-mid entirely, despite being nested two
//   levels down, to join the SAME region as top-level `a`)
// - c (untagged, top-level) -> c-child (untagged) — c has no tagged
//   ancestor anywhere, so it's its own trivial "unclassified" bundle.
function makeDiagram(): Diagram {
  return {
    edgeSets: [],
    frames: [],
    edges: [],
    nodes: [
      { id: 'a', label: 'A Root', position: { x: 0, y: 0 }, metadata: { scope: 'blue' } },
      { id: 'a-child', label: 'A Child', parentId: 'a', position: { x: 0, y: 0 }, metadata: {} },
      { id: 'b', label: 'B Root', position: { x: 0, y: 0 }, metadata: { scope: 'green' } },
      { id: 'b-mid', label: 'B Mid', parentId: 'b', position: { x: 0, y: 0 }, metadata: {} },
      { id: 'b-deep', label: 'B Deep', parentId: 'b-mid', position: { x: 0, y: 0 }, metadata: { scope: 'blue' } },
      { id: 'c', label: 'C Root', position: { x: 0, y: 0 }, metadata: {} },
      { id: 'c-child', label: 'C Child', parentId: 'c', position: { x: 0, y: 0 }, metadata: {} },
    ],
  };
}

// Every node currently visible (nothing collapsed) as plain leaves/
// containers, matching what computeEffectiveGraph would hand back.
function makeVisibleNodes(diagram: Diagram): EffectiveNode[] {
  const hasChild = new Set(diagram.nodes.filter((n) => n.parentId).map((n) => n.parentId!));
  return diagram.nodes.map((n) => ({
    id: n.id,
    label: n.label,
    renderMode: hasChild.has(n.id) ? 'expanded-container' : 'leaf',
    position: n.position,
    parentId: n.parentId,
    metadata: n.metadata,
    dimmed: false,
    highlighted: false,
  }));
}

describe('computeBundleRootOf', () => {
  it('makes a tagged node its own root', () => {
    const roots = computeBundleRootOf(makeDiagram(), 'scope');
    expect(roots.get('a')).toBe('a');
    expect(roots.get('b')).toBe('b');
  });

  it('resolves an untagged node to its nearest tagged ancestor', () => {
    const roots = computeBundleRootOf(makeDiagram(), 'scope');
    expect(roots.get('a-child')).toBe('a');
    expect(roots.get('b-mid')).toBe('b');
  });

  it('breaks a deeply-nested tagged descendant into its own root, regardless of untagged ancestors in between', () => {
    const roots = computeBundleRootOf(makeDiagram(), 'scope');
    expect(roots.get('b-deep')).toBe('b-deep');
  });

  it('makes an untagged top-level node its own trivial (unclassified) root', () => {
    const roots = computeBundleRootOf(makeDiagram(), 'scope');
    expect(roots.get('c')).toBe('c');
    expect(roots.get('c-child')).toBe('c');
  });
});

describe('applyNodeLens', () => {
  it('passes nodes through unchanged when no lens key is active', () => {
    const diagram = makeDiagram();
    const visible = makeVisibleNodes(diagram);
    const result = applyNodeLens(visible, diagram, null);
    expect(result.nodes).toBe(visible);
    expect(result.regions).toEqual([]);
  });

  it('groups bundle roots into regions by tag value, unclassified sorted last', () => {
    const diagram = makeDiagram();
    const result = applyNodeLens(makeVisibleNodes(diagram), diagram, 'scope');
    expect(result.regions.map((r) => r.value)).toEqual(['blue', 'green', UNCLASSIFIED_REGION]);
  });

  it('puts a top-level root and an unrelated deeply-nested tagged descendant in the same region', () => {
    const diagram = makeDiagram();
    const result = applyNodeLens(makeVisibleNodes(diagram), diagram, 'scope');
    const blueRegion = result.regions.find((r) => r.value === 'blue')!;
    expect(blueRegion.rootIds).toEqual(['a', 'b-deep']);
  });

  it('gives every bundle root its own column position, and stacks same-region roots at distinct y', () => {
    const diagram = makeDiagram();
    const result = applyNodeLens(makeVisibleNodes(diagram), diagram, 'scope');
    const byId = new Map(result.nodes.map((n) => [n.id, n]));
    expect(byId.get('a')!.position.x).toBe(byId.get('b-deep')!.position.x); // same region
    expect(byId.get('a')!.position.y).not.toBe(byId.get('b-deep')!.position.y); // distinct slots
    expect(byId.get('b')!.position.x).not.toBe(byId.get('a')!.position.x); // different region
    expect(byId.get('c')!.position.x).not.toBe(byId.get('a')!.position.x);
    expect(byId.get('c')!.position.x).not.toBe(byId.get('b')!.position.x);
  });

  it('detaches only bundle roots from their structural parent, leaving riders nested normally', () => {
    const diagram = makeDiagram();
    const result = applyNodeLens(makeVisibleNodes(diagram), diagram, 'scope');
    const byId = new Map(result.nodes.map((n) => [n.id, n]));
    expect(byId.get('a')!.parentId).toBeUndefined();
    expect(byId.get('b-deep')!.parentId).toBeUndefined();
    expect(byId.get('a-child')!.parentId).toBe('a'); // untouched
    expect(byId.get('b-mid')!.parentId).toBe('b'); // untouched — b-mid isn't a root, it rides with b
  });

  it('flags a container as incomplete only when something inside broke away, with the true total/visible split', () => {
    const diagram = makeDiagram();
    const result = applyNodeLens(makeVisibleNodes(diagram), diagram, 'scope');
    const byId = new Map(result.nodes.map((n) => [n.id, n]));
    expect(byId.get('a')!.lensBundle).toBeUndefined(); // a-child never left
    expect(byId.get('b')!.lensBundle).toEqual({ visible: 1, total: 2 }); // b-mid stayed, b-deep left
    expect(byId.get('b-mid')!.lensBundle).toEqual({ visible: 0, total: 1 }); // its only child, b-deep, left
  });

  it('marks an unclassified root and dims it along with everything still riding with it', () => {
    const diagram = makeDiagram();
    const result = applyNodeLens(makeVisibleNodes(diagram), diagram, 'scope');
    const byId = new Map(result.nodes.map((n) => [n.id, n]));
    expect(byId.get('c')!.lensUnclassified).toBe(true);
    expect(byId.get('c')!.dimmed).toBe(true);
    expect(byId.get('c-child')!.dimmed).toBe(true);
    expect(byId.get('a')!.dimmed).toBe(false);
    expect(byId.get('a')!.lensUnclassified).toBe(false);
  });
});
