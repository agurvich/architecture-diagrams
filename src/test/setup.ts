import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no layout engine, so it never implements ResizeObserver — React
// Flow requires one to exist (it watches the viewport/nodes for size
// changes) even though nothing in jsdom will ever actually fire it. A
// no-op stub is enough for any test that mounts <ReactFlow>/<DiagramCanvas>.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;

afterEach(() => {
  cleanup();
});
