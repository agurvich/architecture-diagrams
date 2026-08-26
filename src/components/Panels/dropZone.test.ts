import { describe, expect, it } from 'vitest';
import { dropZoneFromOffset } from './HierarchyPanel';

describe('dropZoneFromOffset', () => {
  const rowHeight = 20;

  it('top quarter is "before"', () => {
    expect(dropZoneFromOffset(0, rowHeight)).toBe('before');
    expect(dropZoneFromOffset(4.9, rowHeight)).toBe('before');
  });

  it('bottom quarter is "after"', () => {
    expect(dropZoneFromOffset(15.1, rowHeight)).toBe('after');
    expect(dropZoneFromOffset(20, rowHeight)).toBe('after');
  });

  it('the middle half is "inside"', () => {
    expect(dropZoneFromOffset(5, rowHeight)).toBe('inside');
    expect(dropZoneFromOffset(10, rowHeight)).toBe('inside');
    expect(dropZoneFromOffset(15, rowHeight)).toBe('inside');
  });

  it('an offset above the row (dragging fast) still resolves to "before", not a crash', () => {
    expect(dropZoneFromOffset(-50, rowHeight)).toBe('before');
  });

  it('an offset below the row still resolves to "after"', () => {
    expect(dropZoneFromOffset(500, rowHeight)).toBe('after');
  });
});
