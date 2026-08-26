import { describe, expect, it } from 'vitest';
import type { EffectiveNode } from '../types/effectiveGraph';
import {
  CONTAINER_HEADER_HEIGHT,
  CONTAINER_PADDING,
  LEAF_SIZE,
  computeAutoLayoutPositions,
  computeContainerSizes,
  topoSort,
} from './containerLayout';

function leaf(id: string, parentId: string, position: { x: number; y: number }): EffectiveNode {
  return { id, label: id, renderMode: 'leaf', position, parentId, metadata: {}, dimmed: false, highlighted: false };
}

function container(
  id: string,
  overrides: Partial<EffectiveNode> = {},
): EffectiveNode {
  return {
    id,
    label: id,
    renderMode: 'expanded-container',
    position: { x: 0, y: 0 },
    metadata: {},
    dimmed: false,
    highlighted: false,
    ...overrides,
  };
}

describe('computeContainerSizes', () => {
  it('gives a leaf (or a childless container) LEAF_SIZE', () => {
    const nodes = [container('empty')];
    const sizes = computeContainerSizes(nodes);
    expect(sizes.get('empty')).toEqual(LEAF_SIZE);
  });

  it('manual (non-auto-layout) container sizes to the bounding box of its children\'s stored positions', () => {
    const nodes = [
      container('box'),
      leaf('a', 'box', { x: 20, y: 40 }),
      leaf('b', 'box', { x: 300, y: 200 }),
    ];
    const sizes = computeContainerSizes(nodes);
    const box = sizes.get('box')!;
    expect(box.width).toBe(300 + LEAF_SIZE.width + CONTAINER_PADDING * 2);
    expect(box.height).toBe(200 + LEAF_SIZE.height + CONTAINER_PADDING + CONTAINER_HEADER_HEIGHT);
  });

  it('vertical auto-layout container sizes purely from children\'s own sizes and the gap, ignoring their stored positions', () => {
    const nodes = [
      container('stack', { autoLayout: { direction: 'vertical', gap: 10 } }),
      // Deliberately far-apart/out-of-order stored positions — size must
      // not be influenced by these at all for an auto-layout container.
      leaf('a', 'stack', { x: 999, y: 999 }),
      leaf('b', 'stack', { x: -50, y: 5 }),
    ];
    const sizes = computeContainerSizes(nodes);
    const stack = sizes.get('stack')!;
    expect(stack.width).toBe(LEAF_SIZE.width + CONTAINER_PADDING * 2);
    expect(stack.height).toBe(LEAF_SIZE.height * 2 + 10 + CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING);
  });

  it('horizontal auto-layout container sizes along the opposite axis from vertical', () => {
    const nodes = [
      container('row', { autoLayout: { direction: 'horizontal', gap: 10 } }),
      leaf('a', 'row', { x: 0, y: 0 }),
      leaf('b', 'row', { x: 0, y: 0 }),
    ];
    const sizes = computeContainerSizes(nodes);
    const row = sizes.get('row')!;
    expect(row.width).toBe(LEAF_SIZE.width * 2 + 10 + CONTAINER_PADDING * 2);
    expect(row.height).toBe(LEAF_SIZE.height + CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING);
  });

  it('composes recursively — a manual container containing an auto-layout container uses the inner one\'s computed size, not its children\'s raw positions', () => {
    const nodes = [
      container('outer'),
      container('inner', { parentId: 'outer', position: { x: 20, y: 40 }, autoLayout: { direction: 'vertical', gap: 0 } }),
      leaf('a', 'inner', { x: 0, y: 0 }),
      leaf('b', 'inner', { x: 0, y: 0 }),
    ];
    const sizes = computeContainerSizes(nodes);
    const inner = sizes.get('inner')!;
    const outer = sizes.get('outer')!;
    expect(inner.height).toBe(LEAF_SIZE.height * 2 + CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING);
    expect(outer.height).toBe(40 + inner.height + CONTAINER_PADDING + CONTAINER_HEADER_HEIGHT);
  });
});

describe('computeAutoLayoutPositions', () => {
  it('stacks children vertically, top-to-bottom, ordered by their own stored y (not the order they appear in the array)', () => {
    const nodes = [
      container('stack', { autoLayout: { direction: 'vertical', gap: 10 } }),
      leaf('b', 'stack', { x: 0, y: 999 }), // stored "below" a, listed first
      leaf('a', 'stack', { x: 0, y: 0 }),
    ];
    const sizes = computeContainerSizes(nodes);
    const positions = computeAutoLayoutPositions(nodes, sizes);

    expect(positions.get('a')).toEqual({ x: CONTAINER_PADDING, y: CONTAINER_HEADER_HEIGHT });
    expect(positions.get('b')).toEqual({ x: CONTAINER_PADDING, y: CONTAINER_HEADER_HEIGHT + LEAF_SIZE.height + 10 });
  });

  it('reorders when a child\'s stored position moves past a sibling\'s, simulating a drag-to-reorder drop', () => {
    const nodes = [
      container('stack', { autoLayout: { direction: 'vertical', gap: 10 } }),
      leaf('a', 'stack', { x: 0, y: 0 }),
      leaf('b', 'stack', { x: 0, y: 100 }),
    ];
    const sizes = computeContainerSizes(nodes);
    const before = computeAutoLayoutPositions(nodes, sizes);
    expect(before.get('a')!.y).toBeLessThan(before.get('b')!.y);

    // "b" gets dragged above "a" — its stored y drops below a's.
    nodes[2] = leaf('b', 'stack', { x: 0, y: -50 });
    const after = computeAutoLayoutPositions(nodes, sizes);
    expect(after.get('b')!.y).toBeLessThan(after.get('a')!.y);
  });

  it('stacks children horizontally, left-to-right, ordered by stored x', () => {
    const nodes = [
      container('row', { autoLayout: { direction: 'horizontal', gap: 5 } }),
      leaf('a', 'row', { x: 0, y: 0 }),
      leaf('b', 'row', { x: 500, y: 0 }),
    ];
    const sizes = computeContainerSizes(nodes);
    const positions = computeAutoLayoutPositions(nodes, sizes);
    expect(positions.get('a')).toEqual({ x: CONTAINER_PADDING, y: CONTAINER_HEADER_HEIGHT });
    expect(positions.get('b')).toEqual({ x: CONTAINER_PADDING + LEAF_SIZE.width + 5, y: CONTAINER_HEADER_HEIGHT });
  });

  it('returns no override for children of a manually-laid-out container', () => {
    const nodes = [container('box'), leaf('a', 'box', { x: 20, y: 40 })];
    const sizes = computeContainerSizes(nodes);
    const positions = computeAutoLayoutPositions(nodes, sizes);
    expect(positions.has('a')).toBe(false);
  });
});

describe('topoSort', () => {
  it('always orders a parent before its children, regardless of input order', () => {
    const nodes = [leaf('grandchild', 'child', { x: 0, y: 0 }), leaf('child', 'root', { x: 0, y: 0 }), container('root')];
    const ordered = topoSort(nodes);
    const indexOf = (id: string) => ordered.findIndex((n) => n.id === id);
    expect(indexOf('root')).toBeLessThan(indexOf('child'));
    expect(indexOf('child')).toBeLessThan(indexOf('grandchild'));
  });
});
