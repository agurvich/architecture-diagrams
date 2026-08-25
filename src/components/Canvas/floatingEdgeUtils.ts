import { Position, type InternalNode } from '@xyflow/react';

// Adapted from React Flow's official "Floating Edges" example: computes the
// point where the straight line between two nodes' centers crosses each
// node's rectangle, so an edge visually attaches to the node's border
// regardless of which side is closest — this matters here because a node's
// effective size/position changes as it toggles leaf/collapsed/expanded.
// React Flow only fills in `measured.width/height` after its own
// ResizeObserver pass reports back post-paint — and since this app is
// fully controlled and rebuilds a brand-new node object on every render
// (nothing is ever the same reference twice), React Flow's internal
// "unchanged node" fast path never applies, so `measured` gets reset on
// every single recompute and briefly reads `undefined` far more often
// than in a typical app. With `?? 0` that collapsed the intersection
// point to the node's top-left corner (0-radius rectangle) on practically
// every render. `sizeOf` prefers the top-level `width`/`height` we set
// explicitly on each node in DiagramCanvas — synchronously correct,
// no measurement lag — falling back to `measured` only if neither was set.
function sizeOf(node: InternalNode): { width: number; height: number } {
  return {
    width: node.width ?? node.measured.width ?? 0,
    height: node.height ?? node.measured.height ?? 0,
  };
}

function getNodeIntersection(intersectionNode: InternalNode, targetNode: InternalNode) {
  const { width: iw, height: ih } = sizeOf(intersectionNode);
  const intersectionNodePosition = intersectionNode.internals.positionAbsolute;
  const targetPosition = targetNode.internals.positionAbsolute;

  const w = iw / 2;
  const h = ih / 2;

  const x2 = intersectionNodePosition.x + w;
  const y2 = intersectionNodePosition.y + h;
  const x1 = targetPosition.x + sizeOf(targetNode).width / 2;
  const y1 = targetPosition.y + sizeOf(targetNode).height / 2;

  // Rotate 45° into a coordinate space where the rectangle maps to a
  // diamond, so "intersect the diamond" (trivial: normalize to the L1
  // unit circle) corresponds to "intersect the rectangle" back in real
  // space. Combining dx/dy this way — not treating them as independent
  // per-axis fractions — is the part that was missing here: without it,
  // this collapses to a rectangle *corner* for any perfectly vertical or
  // horizontal line (dx=0 or dy=0), since one of the two terms vanishes
  // instead of the two rotated terms partially canceling.
  const dx = (x1 - x2) / (2 * w || 1);
  const dy = (y1 - y2) / (2 * h || 1);
  const xx1 = dx - dy;
  const yy1 = dx + dy;
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (-xx3 + yy3) + y2;

  return { x, y };
}

function getEdgePosition(node: InternalNode, intersectionPoint: { x: number; y: number }) {
  const pos = node.internals.positionAbsolute;
  const { width, height } = sizeOf(node);
  const nx = Math.round(pos.x);
  const ny = Math.round(pos.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);

  if (px <= nx + 1) return Position.Left;
  if (px >= nx + width - 1) return Position.Right;
  if (py <= ny + 1) return Position.Top;
  if (py >= ny + height - 1) return Position.Bottom;
  return Position.Top;
}

export function getFloatingEdgeParams(source: InternalNode, target: InternalNode) {
  const sourceIntersectionPoint = getNodeIntersection(source, target);
  const targetIntersectionPoint = getNodeIntersection(target, source);

  const sourcePos = getEdgePosition(source, sourceIntersectionPoint);
  const targetPos = getEdgePosition(target, targetIntersectionPoint);

  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos,
    targetPos,
  };
}
