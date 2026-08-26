import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clampToViewport } from './clampToViewport';

describe('clampToViewport', () => {
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalHeight, configurable: true });
  });

  it('passes the position through unchanged when the box fits fully on-screen', () => {
    expect(clampToViewport(100, 100, 220, 220, 10)).toEqual({ left: 100, top: 100 });
  });

  it('clamps to the right/bottom margin when the requested position would overflow', () => {
    expect(clampToViewport(790, 590, 220, 220, 10)).toEqual({ left: 570, top: 370 });
  });

  it('clamps to the margin itself when the box is larger than the viewport', () => {
    expect(clampToViewport(50, 50, 2000, 2000, 10)).toEqual({ left: 10, top: 10 });
  });
});
