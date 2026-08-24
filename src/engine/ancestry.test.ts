import { describe, expect, it } from 'vitest';
import type { Diagram } from '../types/diagram';
import { buildAncestryIndex, getDescendants, hasChildren, resolveVisibleAncestor } from './ancestry';

// root -> mid -> leaf, three levels deep, to exercise resolution past an
// immediate parent.
function makeDiagram(): Diagram {
  return {
    edgeSets: [],
    frames: [],
    edges: [],
    nodes: [
      { id: 'root', label: 'Root', position: { x: 0, y: 0 }, metadata: {} },
      { id: 'mid', label: 'Mid', parentId: 'root', position: { x: 0, y: 0 }, metadata: {} },
      { id: 'leaf', label: 'Leaf', parentId: 'mid', position: { x: 0, y: 0 }, metadata: {} },
      { id: 'other', label: 'Other', position: { x: 0, y: 0 }, metadata: {} },
    ],
  };
}

describe('ancestry', () => {
  it('reports hasChildren correctly', () => {
    const index = buildAncestryIndex(makeDiagram());
    expect(hasChildren(index, 'root')).toBe(true);
    expect(hasChildren(index, 'mid')).toBe(true);
    expect(hasChildren(index, 'leaf')).toBe(false);
    expect(hasChildren(index, 'other')).toBe(false);
  });

  it('resolves a leaf to itself when every ancestor is expanded', () => {
    const index = buildAncestryIndex(makeDiagram());
    const expanded = new Set(['root', 'mid']);
    expect(resolveVisibleAncestor(index, 'leaf', expanded)).toBe('leaf');
  });

  it('resolves a leaf to the topmost collapsed ancestor, not the nearest one', () => {
    const index = buildAncestryIndex(makeDiagram());
    // root is collapsed, mid is (irrelevantly) "expanded" — root wins since
    // it's encountered first walking root-to-node.
    const expanded = new Set(['mid']);
    expect(resolveVisibleAncestor(index, 'leaf', expanded)).toBe('root');
  });

  it('resolves an intermediate node to its own collapsed parent', () => {
    const index = buildAncestryIndex(makeDiagram());
    const expanded = new Set(['root']); // root expanded, mid collapsed
    expect(resolveVisibleAncestor(index, 'mid', expanded)).toBe('mid');
    expect(resolveVisibleAncestor(index, 'leaf', expanded)).toBe('mid');
  });

  it('resolves a node with no parent to itself', () => {
    const index = buildAncestryIndex(makeDiagram());
    expect(resolveVisibleAncestor(index, 'other', new Set())).toBe('other');
  });

  it('collects all nested descendants, not just direct children', () => {
    const index = buildAncestryIndex(makeDiagram());
    expect(getDescendants(index, 'root').sort()).toEqual(['leaf', 'mid']);
    expect(getDescendants(index, 'mid')).toEqual(['leaf']);
    expect(getDescendants(index, 'leaf')).toEqual([]);
  });
});
