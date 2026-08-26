import type { EffectiveNode } from '../types/effectiveGraph';
import { groupByParent } from '../utils/groupByParent';

export const LEAF_SIZE = { width: 170, height: 64 };
export const CONTAINER_PADDING = 20;
export const CONTAINER_HEADER_HEIGHT = 34;
export const ANCHOR_SIZE = 26;
// Large enough that an edge drawn between two adjacent auto-layout
// siblings has room to show both a visible line segment and its
// arrowhead (the marker itself is 7x7, see DiagramCanvas.tsx's
// <marker id="graph-edge-arrow">) instead of the two boxes crowding
// right up against each other with nothing but the arrowhead squeezed
// into the gap. Only the fallback for a container that has never had its
// own gap set — editing an existing container's gap (properties panel or
// its own stored value) always wins over this.
export const DEFAULT_AUTO_LAYOUT_GAP = 40;

export type Size = { width: number; height: number };

/**
 * Each visible node's rendered size, bottom-up: a leaf (or a
 * collapsed/childless group) is always LEAF_SIZE; an expanded container's
 * size is the bounding box of its children — either their stored
 * positions (manual layout) or a stacked row/column sized purely from
 * their own sizes and the configured gap (auto layout, where a child's
 * stored position is never treated as authoritative for sizing — only
 * for sort order, see computeAutoLayoutPositions).
 */
export function computeContainerSizes(nodes: EffectiveNode[]): Map<string, Size> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = groupByParent(nodes);
  const sizeCache = new Map<string, Size>();

  function sizeOf(id: string): Size {
    const cached = sizeCache.get(id);
    if (cached) return cached;
    const node = byId.get(id);
    if (!node || node.renderMode !== 'expanded-container') {
      sizeCache.set(id, LEAF_SIZE);
      return LEAF_SIZE;
    }
    const children = childrenOf.get(id) ?? [];
    if (children.length === 0) {
      sizeCache.set(id, LEAF_SIZE);
      return LEAF_SIZE;
    }

    let size: Size;
    if (node.autoLayout) {
      const { direction, gap } = node.autoLayout;
      let mainAxisTotal = 0;
      let crossAxisMax = 0;
      for (const child of children) {
        const childSize = sizeOf(child.id);
        const main = direction === 'vertical' ? childSize.height : childSize.width;
        const cross = direction === 'vertical' ? childSize.width : childSize.height;
        mainAxisTotal += main;
        crossAxisMax = Math.max(crossAxisMax, cross);
      }
      mainAxisTotal += gap * (children.length - 1);
      size =
        direction === 'vertical'
          ? { width: crossAxisMax + CONTAINER_PADDING * 2, height: mainAxisTotal + CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING }
          : { width: mainAxisTotal + CONTAINER_PADDING * 2, height: crossAxisMax + CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING };
    } else {
      let maxX = 0;
      let maxY = 0;
      for (const child of children) {
        const childSize = sizeOf(child.id);
        maxX = Math.max(maxX, child.position.x + childSize.width);
        maxY = Math.max(maxY, child.position.y + childSize.height);
      }
      size = { width: maxX + CONTAINER_PADDING * 2, height: maxY + CONTAINER_PADDING + CONTAINER_HEADER_HEIGHT };
    }
    sizeCache.set(id, size);
    return size;
  }

  for (const n of nodes) sizeOf(n.id);
  return sizeCache;
}

export function topoSort(nodes: EffectiveNode[]): EffectiveNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const ordered: EffectiveNode[] = [];

  function visit(node: EffectiveNode) {
    if (visited.has(node.id)) return;
    if (node.parentId && byId.has(node.parentId)) visit(byId.get(node.parentId)!);
    visited.add(node.id);
    ordered.push(node);
  }
  for (const n of nodes) visit(n);
  return ordered;
}

/**
 * Position overrides (relative to their own parent, same coordinate space
 * as DiagramNode.position) for every child of an auto-layout container —
 * a plain object stack/row, top-left aligned, ordered by each child's own
 * *stored* position along the layout axis (top-to-bottom for vertical,
 * left-to-right for horizontal), so dragging a child near a different
 * sibling and letting go reorders it there on the next computation instead
 * of requiring a separate explicit order field. Nodes not inside any
 * auto-layout container are absent from the returned map — callers fall
 * back to the node's own stored position for those.
 *
 * `excludeId`, when given, gets no override entry — the caller wants that
 * one node to render at its own raw (live-updating, cursor-following)
 * position instead, e.g. because it's the node currently being dragged.
 * It's still included as an input to every *other* sibling's computed
 * slot (via the sort and the running offset), so dragging it to a new
 * spot in the order reflows its siblings live to make room, instead of
 * freezing the whole container's layout for the duration of the drag.
 */
export function computeAutoLayoutPositions(
  nodes: EffectiveNode[],
  sizes: Map<string, Size>,
  excludeId?: string,
): Map<string, { x: number; y: number }> {
  const childrenOf = groupByParent(nodes);
  const overrides = new Map<string, { x: number; y: number }>();

  for (const node of nodes) {
    if (!node.autoLayout) continue;
    const children = childrenOf.get(node.id) ?? [];
    if (children.length === 0) continue;
    const { direction, gap } = node.autoLayout;
    const sorted = [...children].sort((a, b) =>
      direction === 'vertical' ? a.position.y - b.position.y : a.position.x - b.position.x,
    );

    let offset = direction === 'vertical' ? CONTAINER_HEADER_HEIGHT : CONTAINER_PADDING;
    for (const child of sorted) {
      const childSize = sizes.get(child.id) ?? LEAF_SIZE;
      if (child.id !== excludeId) {
        overrides.set(
          child.id,
          direction === 'vertical' ? { x: CONTAINER_PADDING, y: offset } : { x: offset, y: CONTAINER_HEADER_HEIGHT },
        );
      }
      offset += (direction === 'vertical' ? childSize.height : childSize.width) + gap;
    }
  }

  return overrides;
}
