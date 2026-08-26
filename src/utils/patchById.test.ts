import { describe, expect, it } from 'vitest';
import { patchById } from './patchById';

describe('patchById', () => {
  const items = [
    { id: 'a', name: 'A', count: 1 },
    { id: 'b', name: 'B', count: 2 },
  ];

  it('shallow-merges the patch into the matching item only', () => {
    const result = patchById(items, 'a', { count: 5 });
    expect(result).toEqual([
      { id: 'a', name: 'A', count: 5 },
      { id: 'b', name: 'B', count: 2 },
    ]);
  });

  it('leaves the array unchanged when no item matches', () => {
    const result = patchById(items, 'nonexistent', { count: 99 });
    expect(result).toEqual(items);
  });

  it('returns a new array (and new matching object), not the same reference', () => {
    const result = patchById(items, 'a', { count: 5 });
    expect(result).not.toBe(items);
    expect(result[0]).not.toBe(items[0]);
    expect(result[1]).toBe(items[1]);
  });
});
