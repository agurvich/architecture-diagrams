import ELK from 'elkjs/lib/elk.bundled.js';
import type { Size } from './containerLayout';

// The bundled build runs synchronously in the main thread instead of
// spinning up a Web Worker (which would need its own served asset URL) —
// simplest choice for a one-shot, user-triggered layout at this app's
// diagram sizes.
const elk = new ELK();

export interface LayoutInputNode {
  id: string;
  size: Size;
}

export interface LayoutInputEdge {
  sourceId: string;
  targetId: string;
}

/**
 * Runs elk's layered algorithm (Sugiyama-style, with its default
 * crossing-minimizing layer sweep) over a flat set of boxes and the edges
 * between them, treating each box as opaque — nothing about a box's own
 * internal contents is touched, only its position as a whole. Returns each
 * box's top-left position normalized so the tightest bounding box around
 * the whole result starts at (0, 0); callers place that block wherever it
 * belongs (a container's padded interior, or anchored back near wherever
 * the same nodes already sit on canvas).
 */
export async function computeGraphLayout(
  nodes: LayoutInputNode[],
  edges: LayoutInputEdge[],
): Promise<Map<string, { x: number; y: number }>> {
  if (nodes.length === 0) return new Map();

  const result = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    children: nodes.map((n) => ({ id: n.id, width: n.size.width, height: n.size.height })),
    edges: edges.map((e, i) => ({ id: `layout-edge-${i}`, sources: [e.sourceId], targets: [e.targetId] })),
  });

  const positions = new Map<string, { x: number; y: number }>();
  for (const child of result.children ?? []) {
    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  }
  if (minX === Infinity) return positions;
  for (const [id, pos] of positions) positions.set(id, { x: pos.x - minX, y: pos.y - minY });
  return positions;
}
