import { describe, expect, it } from 'vitest';
import { groupByParent } from './groupByParent';

describe('groupByParent', () => {
  it('groups items under their parentId, in original relative order', () => {
    const items = [
      { id: 'a', parentId: 'root' },
      { id: 'b', parentId: 'root' },
      { id: 'c', parentId: 'other' },
    ];
    const map = groupByParent(items);
    expect(map.get('root')).toEqual([items[0], items[1]]);
    expect(map.get('other')).toEqual([items[2]]);
  });

  it('buckets top-level items (no parentId) under the undefined key', () => {
    const items = [{ id: 'root1' }, { id: 'root2' }, { id: 'child', parentId: 'root1' }];
    const map = groupByParent(items);
    expect(map.get(undefined)).toEqual([items[0], items[1]]);
    expect(map.get('root1')).toEqual([items[2]]);
  });

  it('a parent with no children has no entry at all', () => {
    const items = [{ id: 'lonely' }];
    const map = groupByParent(items);
    expect(map.get('lonely')).toBeUndefined();
  });
});
