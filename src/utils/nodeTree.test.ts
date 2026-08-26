import { describe, expect, it } from 'vitest';
import { wouldCreateCycle } from './nodeTree';

describe('wouldCreateCycle', () => {
  // a -> b -> c (c's parent is b, b's parent is a, a is top-level)
  const nodes = [{ id: 'a' }, { id: 'b', parentId: 'a' }, { id: 'c', parentId: 'b' }];

  it('is true when the candidate parent is the node itself', () => {
    expect(wouldCreateCycle(nodes, 'a', 'a')).toBe(true);
  });

  it('is true when the candidate parent is a direct child of the node', () => {
    expect(wouldCreateCycle(nodes, 'a', 'b')).toBe(true);
  });

  it('is true when the candidate parent is a deeper descendant of the node', () => {
    expect(wouldCreateCycle(nodes, 'a', 'c')).toBe(true);
  });

  it('is false when the candidate parent is an unrelated top-level node', () => {
    const withUnrelated = [...nodes, { id: 'd' }];
    expect(wouldCreateCycle(withUnrelated, 'c', 'd')).toBe(false);
  });

  it('is false when the candidate parent is the node\'s own ancestor (moving up, not creating a cycle)', () => {
    expect(wouldCreateCycle(nodes, 'c', 'a')).toBe(false);
  });

  it('is false when the candidate parent is a sibling, not an ancestor or descendant', () => {
    const withSibling = [...nodes, { id: 'sibling', parentId: 'a' }];
    expect(wouldCreateCycle(withSibling, 'b', 'sibling')).toBe(false);
  });

  it('handles a candidate parent that does not exist in the node list without throwing', () => {
    expect(wouldCreateCycle(nodes, 'a', 'nonexistent')).toBe(false);
  });
});
