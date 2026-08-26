import { describe, expect, it } from 'vitest';
import { getHandlePoint, getRectIntersection, type Rect } from './floatingEdgeUtils';

describe('getRectIntersection', () => {
  // A 100x100 square centered at (50, 50).
  const square: Rect = { x: 0, y: 0, width: 100, height: 100 };

  it('hits the right-middle border when the other rect is directly to the right', () => {
    const other: Rect = { x: 300, y: 0, width: 100, height: 100 };
    const point = getRectIntersection(square, other);
    expect(point.x).toBeCloseTo(100);
    expect(point.y).toBeCloseTo(50);
  });

  it('hits the left-middle border when the other rect is directly to the left', () => {
    const other: Rect = { x: -300, y: 0, width: 100, height: 100 };
    const point = getRectIntersection(square, other);
    expect(point.x).toBeCloseTo(0);
    expect(point.y).toBeCloseTo(50);
  });

  it('hits the bottom-middle border when the other rect is directly below', () => {
    const other: Rect = { x: 0, y: 300, width: 100, height: 100 };
    const point = getRectIntersection(square, other);
    expect(point.x).toBeCloseTo(50);
    expect(point.y).toBeCloseTo(100);
  });

  it('hits the top-middle border when the other rect is directly above', () => {
    const other: Rect = { x: 0, y: -300, width: 100, height: 100 };
    const point = getRectIntersection(square, other);
    expect(point.x).toBeCloseTo(50);
    expect(point.y).toBeCloseTo(0);
  });

  it('hits exactly the bottom-right corner on a perfect 45° diagonal for a square', () => {
    const other: Rect = { x: 300, y: 300, width: 100, height: 100 };
    const point = getRectIntersection(square, other);
    expect(point.x).toBeCloseTo(100);
    expect(point.y).toBeCloseTo(100);
  });

  it('does not collapse to a corner for a non-45° line on a perfectly vertical or horizontal case (regression: dx=0 previously vanished one rotated term)', () => {
    const other: Rect = { x: 0, y: -300, width: 100, height: 100 };
    const point = getRectIntersection(square, other);
    // Top-middle, not a corner (0,0) or (100,0).
    expect(point.x).toBeCloseTo(50);
  });

  it('scales proportionally to width/height for a non-square rect', () => {
    // A wide rect: intersecting toward something directly above should
    // still land at its horizontal center, regardless of width.
    const wide: Rect = { x: 0, y: 0, width: 400, height: 40 };
    // Centered on the same x as `wide` (200) so the line between centers
    // is purely vertical.
    const other: Rect = { x: 180, y: -300, width: 40, height: 40 };
    const point = getRectIntersection(wide, other);
    expect(point.x).toBeCloseTo(200);
    expect(point.y).toBeCloseTo(0);
  });
});

describe('getHandlePoint', () => {
  const rect: Rect = { x: 10, y: 20, width: 100, height: 50 };

  it('top: horizontal center, at the rect\'s own y', () => {
    expect(getHandlePoint(rect, 'top')).toEqual({ x: 60, y: 20 });
  });

  it('bottom: horizontal center, at the rect\'s bottom edge', () => {
    expect(getHandlePoint(rect, 'bottom')).toEqual({ x: 60, y: 70 });
  });

  it('left: vertical center, at the rect\'s own x', () => {
    expect(getHandlePoint(rect, 'left')).toEqual({ x: 10, y: 45 });
  });

  it('right: vertical center, at the rect\'s right edge', () => {
    expect(getHandlePoint(rect, 'right')).toEqual({ x: 110, y: 45 });
  });
});
